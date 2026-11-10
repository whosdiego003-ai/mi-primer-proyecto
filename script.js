// ====== Referencias al DOM ======
const input = document.getElementById('passwordInput');
const clearBtn = document.getElementById('clearBtn');
const resultText = document.getElementById('result');
const progressBar = document.getElementById('progressBar');
const matchDisplay = document.getElementById('matchDisplay');

const chips = document.querySelectorAll('#charsetChips .chip[data-set]');
const lenValue = document.getElementById('lenValue');
const entropyValue = document.getElementById('entropyValue');

const attackTerminal = document.getElementById('attackTerminal');
const attackStatus = document.getElementById('attackStatus');
const attackSpeed = document.getElementById('attackSpeed');
const attackStream = document.getElementById('attackStream');
const attackCount = document.getElementById('attackCount');

// ====== Configuración ======
// Calibración de velocidad realista para un Rig de GPU de gama alta
// (Hashcat offline: ~100 mil millones de hashes/segundo para MD5/SHA)
const VELOCIDAD_GPU = 100000000000;

// Alfabetos ordenados tal como los recorre un ataque de fuerza bruta.
const ALF_MINUS = 'abcdefghijklmnopqrstuvwxyz';
const ALF_MAYUS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALF_NUM = '0123456789';
const ALF_SIMB = ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

// Diccionario de contraseñas filtradas. Set para búsqueda O(1).
const DICCIONARIO = (typeof diccionario !== 'undefined') ? diccionario : [];
const DICCIONARIO_SET = new Set(DICCIONARIO);

// Nombres/palabras comunes en español que se le pasan a zxcvbn para que
// detecte contraseñas basadas en nombres (sueltos o combinados).
const NOMBRES = (typeof nombresComunes !== 'undefined') ? nombresComunes : [];
const NOMBRES_SET = new Set(NOMBRES);

// Redes sociales, influencers, celebridades, personajes, bandas, películas...
// (famosos.js, sacado de Wikidata).
// Guardamos de qué categoría es cada palabra para explicarlo en el resultado.
const FAMOSOS = (typeof famosos !== 'undefined') ? famosos : {};
const CATEGORIA_FAMOSO = new Map();
for (const [categoria, palabras] of Object.entries(FAMOSOS)) {
    for (const palabra of palabras) {
        if (!CATEGORIA_FAMOSO.has(palabra)) CATEGORIA_FAMOSO.set(palabra, categoria);
    }
}
const ETIQUETA_CATEGORIA = {
    redsocial: 'una red social/app',
    palabra: 'una palabra común',
    influencer: 'un influencer',
    usuario: 'un usuario de redes',
    celebridad: 'una celebridad',
    personaje: 'un personaje',
    pokemon: 'un Pokémon',
    banda: 'una banda/grupo',
    franquicia: 'una franquicia',
    pelicula: 'una película',
    serie: 'una serie',
    videojuego: 'un videojuego',
    equipo: 'un equipo'
};

// Todo junto para zxcvbn: primero los nombres comunes y luego los famosos
// (zxcvbn considera más "probables" las palabras que van primero).
const EXTRA_DICT = NOMBRES.concat([...CATEGORIA_FAMOSO.keys()].filter(p => !NOMBRES_SET.has(p)));

let timeoutDebounce;   // espera a que el usuario deje de escribir
let rafAtaque = null;  // id de la animación del ataque en curso

// ====== Utilidades ======
// "Pokémon" -> "Pokemon": las listas están sin acentos, así que analizamos igual.
function quitarAcentos(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function formatearNumero(n) {
    if (n < 1000) return Math.floor(n).toString();
    if (n < 1e6) return (n / 1e3).toFixed(1) + ' mil';
    if (n < 1e9) return (n / 1e6).toFixed(1) + ' millones';
    if (n < 1e12) return (n / 1e9).toFixed(1) + ' mil millones';
    if (n < 1e15) return (n / 1e12).toFixed(1) + ' billones';
    return n.toExponential(1);
}

function formatearTiempo(segundos) {
    if (segundos < 0.000001) return "instantáneo";
    if (segundos < 0.001) return (segundos * 1e6).toFixed(0) + " microsegundos";
    if (segundos < 1) return (segundos * 1000).toFixed(1) + " milisegundos";
    if (segundos < 60) return segundos.toFixed(1) + " segundos";
    if (segundos < 3600) return (segundos / 60).toFixed(1) + " minutos";
    if (segundos < 86400) return (segundos / 3600).toFixed(1) + " horas";
    if (segundos < 31536000) return (segundos / 86400).toFixed(1) + " días";
    if (segundos < 31536000000) return (segundos / 31536000).toFixed(1) + " años";
    return (segundos / 31536000000).toFixed(1) + " milenios";
}

// Remate humano para tiempos muy grandes: los traduce a algo entendible
// (edad del universo, historia de la civilización...). Vacío si es corto.
function comparacionHumana(segundos) {
    const años = segundos / 31536000;
    const EDAD_UNIVERSO = 13.8e9; // en años
    if (años >= EDAD_UNIVERSO) return formatearNumero(años / EDAD_UNIVERSO) + " veces la edad del universo";
    if (años >= 1e6) return "millones de años de cómputo sin parar";
    if (años >= 6000) return "más que toda la historia de la civilización humana";
    if (años >= 100) return "siglos de cómputo ininterrumpido";
    return "";
}

function traducirAdvertencia(warning) {
    if (!warning) return "Estructura predecible o credencial común";
    const w = warning.toLowerCase();
    if (w.includes("straight rows") || w.includes("keyboard rows")) return "Las filas rectas de teclas son fáciles de adivinar";
    if (w.includes("sequences")) return "Se detectó una secuencia numérica o alfabética predecible";
    if (w.includes("recent years") || w.includes("years")) return "Contiene un año o fecha reciente muy común";
    if (w.includes("repeated")) return "Se detectaron caracteres repetidos consecutivamente";
    if (w.includes("names") || w.includes("surnames")) return "Los nombres y apellidos son muy fáciles de adivinar";
    if (w.includes("dictionary") || w.includes("common")) return "La contraseña coincide con bases de datos de palabras comunes";
    return "Estructura predecible o vulnerable";
}

// Describe qué patrones predecibles encontró zxcvbn dentro de la clave, para
// explicar por qué es débil (ej: "Contiene una fecha '150423'").
function describirMatches(analisis) {
    const nombres = {
        dictionary: 'nombre/palabra común',
        date: 'una fecha',
        sequence: 'una secuencia',
        repeat: 'caracteres repetidos',
        spatial: 'un patrón de teclado',
        regex: 'un patrón común'
    };
    const partes = (analisis.sequence || [])
        .filter(m => m.pattern !== 'bruteforce' && m.token)
        .map(m => tipoDeMatch(m, nombres) + ' "' + m.token.trim() + '"');

    if (partes.length === 0) return "";
    if (partes.length === 1) return "Contiene " + partes[0];
    return "Se compone de " + partes.join(" + ");
}

// Para palabras de diccionario, dice si es un nombre común o qué tipo de
// famoso es (celebridad, personaje, Pokémon...). Detecta también l33t (g0ku).
function tipoDeMatch(m, nombres) {
    if (m.pattern === 'dictionary') {
        const palabra = m.matched_word;
        if (NOMBRES_SET.has(palabra)) return 'un nombre común';
        const categoria = CATEGORIA_FAMOSO.get(palabra);
        if (categoria) return ETIQUETA_CATEGORIA[categoria] || 'un nombre famoso';
    }
    return nombres[m.pattern] || 'un patrón';
}

// Tamaño real del alfabeto que cubre un tramo (zxcvbn asume solo 10, lo que
// subestima las partes aleatorias; aquí usamos la cardinalidad verdadera).
function cardinalidadToken(token) {
    let n = 0;
    if (/[a-z]/.test(token)) n += 26;
    if (/[A-Z]/.test(token)) n += 26;
    if (/[0-9]/.test(token)) n += 10;
    if (/[^a-zA-Z0-9]/.test(token)) n += 32;
    return n || 1;
}

// Nº realista de conjeturas: para los tramos con patrón usamos la estimación de
// zxcvbn (dictionary, date, sequence...) y para los tramos aleatorios la fuerza
// bruta real (alfabeto^longitud) en vez del flojo 10^longitud de zxcvbn.
function conjeturasReales(analisis) {
    const seq = analisis.sequence || [];
    if (!seq.length) return analisis.guesses;
    let total = 1;
    for (const m of seq) {
        if (m.pattern === 'bruteforce') {
            total *= Math.pow(cardinalidadToken(m.token || ''), (m.token || '').length);
        } else {
            total *= (m.guesses || 1);
        }
    }
    return total;
}

// Separadores que la gente usa entre palabras: "lupita tiktok", "goku_123"...
const SEPARADORES = /[\s._\-]+/g;

// Analiza los patrones de la clave tal cual y también sin separadores, y se
// queda con el más débil: así "cristiano ronaldo" o "lupita ama tiktok" (2, 3
// o más palabras) se detectan como palabras conocidas. Al quitar separadores
// sumamos el costo de adivinarlos para no subestimar la clave.
function analizarPatrones(pwd) {
    const base = quitarAcentos(pwd);
    const analisis = zxcvbn(base, EXTRA_DICT);
    const normal = { analisis, conjeturas: conjeturasReales(analisis), conSeparadores: false };

    const sinSep = base.replace(SEPARADORES, '');
    if (!sinSep || sinSep === base) return normal;

    // Dónde iban los separadores (en posiciones de 'sinSep') y cuáles se usaron
    const cortes = [];
    const tipos = new Set();
    let quitados = 0;
    for (const m of base.matchAll(SEPARADORES)) {
        cortes.push(m.index - quitados);
        tipos.add(m[0]);
        quitados += m[0].length;
    }

    // Opción A: todo junto sin separadores ("cristianoronaldo" = un solo famoso).
    // Si cada separador cae justo entre dos palabras/patrones detectados, el
    // atacante (ataque combinador) ya sabe dónde van: solo adivina cuál usar.
    // Si no, también tiene que adivinar la posición de cada uno.
    const alt = zxcvbn(sinSep, EXTRA_DICT);
    const bordes = new Set((alt.sequence || []).map(m => m.i));
    const alineados = cortes.every(c => c === 0 || c === sinSep.length || bordes.has(c));
    const costoSeparadores = alineados
        ? Math.pow(4, tipos.size)
        : Math.pow(4 * (sinSep.length + 1), cortes.length);
    const juntas = { analisis: alt, conjeturas: conjeturasReales(alt) * costoSeparadores, conSeparadores: true };

    // Opción B: palabra por palabra ("juan ama a maria" = 4 palabras conocidas).
    // Conjeturas = producto de las de cada palabra x cuál separador se usó.
    const secuencia = [];
    let conjeturasPalabras = Math.pow(4, tipos.size);
    for (const palabra of base.split(SEPARADORES).filter(Boolean)) {
        const a = zxcvbn(palabra, EXTRA_DICT);
        conjeturasPalabras *= conjeturasReales(a);
        secuencia.push(...(a.sequence || []));
    }
    const separadas = {
        analisis: { sequence: secuencia, feedback: alt.feedback },
        conjeturas: conjeturasPalabras,
        conSeparadores: true
    };

    // Gana el ataque más rápido
    return [normal, juntas, separadas].reduce((mejor, op) => op.conjeturas < mejor.conjeturas ? op : mejor);
}

// ====== Análisis del espacio de caracteres (fuerza bruta) ======
function alfabetoDe(pwd) {
    let alf = '';
    if (/[a-z]/.test(pwd)) alf += ALF_MINUS;
    if (/[A-Z]/.test(pwd)) alf += ALF_MAYUS;
    if (/[0-9]/.test(pwd)) alf += ALF_NUM;
    if (/[^a-zA-Z0-9]/.test(pwd)) alf += ALF_SIMB;
    return alf;
}

function analizarCharset(pwd) {
    const sets = {
        lower: /[a-z]/.test(pwd),
        upper: /[A-Z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        symbol: /[^a-zA-Z0-9]/.test(pwd)
    };
    const poolSize = alfabetoDe(pwd).length;

    const entropia = pwd.length > 0 && poolSize > 0
        ? Math.round(pwd.length * Math.log2(poolSize))
        : 0;

    // Combinaciones totales = (tamaño del conjunto) ^ (longitud)
    const combinaciones = Math.pow(poolSize || 1, pwd.length);
    // En fuerza bruta, en promedio se adivina en la mitad del espacio
    const segundos = (combinaciones / 2) / VELOCIDAD_GPU;

    return { sets, poolSize, entropia, segundos };
}

// Nº de intento exacto en que un ataque de fuerza bruta en orden
// (longitud 1, luego 2, 3... y dentro de cada una en orden del alfabeto)
// llegaría a 'pwd'. Devuelve Infinity si algún carácter no es representable.
function intentoDeFuerzaBruta(pwd, alfabeto) {
    const base = alfabeto.length;
    if (base === 0) return Infinity;

    // Todas las combinaciones de longitudes menores
    let total = 0;
    for (let l = 1; l < pwd.length; l++) total += Math.pow(base, l);

    // Posición dentro de las combinaciones de esta longitud (como un odómetro)
    let idx = 0;
    for (let i = 0; i < pwd.length; i++) {
        const p = alfabeto.indexOf(pwd[i]);
        if (p < 0) return Infinity; // carácter raro: no lo cubre este alfabeto
        idx = idx * base + p;
    }
    return total + idx + 1; // 1-based
}

// Actualiza los "chips" de charset de forma instantánea (barato, en cada tecla)
function actualizarChips(pwd, info) {
    chips.forEach(chip => {
        const tipo = chip.dataset.set;
        if (info.sets[tipo]) chip.classList.add('on');
        else chip.classList.remove('on');
    });
    lenValue.textContent = pwd.length;
    entropyValue.textContent = info.entropia;
}

// ====== Simulación visual del ataque ======
function detenerAtaque() {
    if (rafAtaque) {
        cancelAnimationFrame(rafAtaque);
        rafAtaque = null;
    }
}

function muestraAleatoria() {
    if (DICCIONARIO.length === 0) return "??????";
    return DICCIONARIO[Math.floor(Math.random() * DICCIONARIO.length)];
}

// Animación genérica: cuenta hasta 'contadorFinal' y en cada frame muestra
// lo que devuelva 'generador(intentoActual)'. Al terminar llama a 'onFin'.
function animarAtaque(contadorFinal, generador, duracion, onFin) {
    const inicio = performance.now();
    function frame(now) {
        const t = now - inicio;
        const avance = Math.min(t / duracion, 1);
        const eased = avance * avance; // arranca lento y acelera
        const valor = contadorFinal * eased;

        attackCount.textContent = formatearNumero(valor);
        attackStream.textContent = 'probando › ' + generador(valor);

        if (t < duracion) {
            rafAtaque = requestAnimationFrame(frame);
        } else {
            attackCount.textContent = formatearNumero(contadorFinal);
            rafAtaque = null;
            onFin();
        }
    }
    rafAtaque = requestAnimationFrame(frame);
}

// Animación de fuerza bruta: va "escribiendo" la contraseña adivinada carácter
// por carácter (las posiciones ya encontradas se fijan; el resto gira al azar).
function animarRevelado(pwd, alfabeto, contadorFinal, duracion, onFin) {
    const inicio = performance.now();
    const alf = alfabeto.length ? alfabeto : ALF_MINUS;
    function frame(now) {
        const t = now - inicio;
        const avance = Math.min(t / duracion, 1);
        const fijados = Math.floor(avance * pwd.length);

        let cadena = '';
        for (let i = 0; i < pwd.length; i++) {
            cadena += (i < fijados) ? pwd[i] : alf[Math.floor(Math.random() * alf.length)];
        }
        attackCount.textContent = formatearNumero(contadorFinal * (avance * avance));
        attackStream.textContent = 'probando › ' + cadena;

        if (t < duracion) {
            rafAtaque = requestAnimationFrame(frame);
        } else {
            attackCount.textContent = formatearNumero(contadorFinal);
            attackStream.textContent = 'probando › ' + pwd;
            rafAtaque = null;
            onFin();
        }
    }
    rafAtaque = requestAnimationFrame(frame);
}

function lanzarAtaque(pwd) {
    detenerAtaque();

    const { analisis, conjeturas, conSeparadores } = analizarPatrones(pwd);
    const info = analizarCharset(pwd);
    const alfabeto = alfabetoDe(pwd);
    const enDiccionario = DICCIONARIO_SET.has(pwd);
    const intentoBrute = intentoDeFuerzaBruta(pwd, alfabeto);
    // Intentos para adivinarla por fuerza bruta (si algún carácter es raro, usamos el promedio).
    const intentosFuerzaBruta = isFinite(intentoBrute) ? intentoBrute : info.segundos * VELOCIDAD_GPU;

    // ¿La clave está hecha de patrones conocidos (nombres, palabras, secuencias,
    // fechas, teclado...)? zxcvbn marca esos tramos con un 'pattern' != 'bruteforce'.
    const combinaciones = info.segundos * 2 * VELOCIDAD_GPU; // = poolSize^longitud
    const tieneEstructura = (analisis.sequence || []).some(m => m.pattern !== 'bruteforce');
    const porPatron = tieneEstructura && conjeturas < combinaciones;

    // Tiempo real de crackeo = el mejor ataque disponible para el atacante.
    // Si tiene estructura, el ataque por patrones; si es aleatoria, fuerza bruta.
    const segundosReal = porPatron
        ? Math.min(conjeturas / VELOCIDAD_GPU, info.segundos)
        : info.segundos;

    attackTerminal.className = 'attack-terminal active';
    attackStatus.textContent = '⬤ ATACANDO...';
    attackStatus.className = 'attack-status run';
    attackSpeed.textContent = formatearNumero(VELOCIDAD_GPU) + ' intentos/s';

    // 1) Está en el diccionario de filtraciones
    if (enDiccionario) {
        attackSpeed.textContent = 'ataque por diccionario';
        animarAtaque(2500000000, muestraAleatoria, 1400, () => {
            marcarCrackeada(pwd, '¡MATCH! › ');
            escribirTexto("¡CRACKEADO!<br>Tiempo estimado: instantáneo", "texto-rojo");
            actualizarBarra(10, 'bg-rojo');
            mostrarMatch("🔓 CONTRASEÑA FILTRADA: APARECE EN LISTAS DE ATAQUE REALES 🔓");
        });
        return;
    }

    // 2) Crackeable rápido (< 1 minuto): la adivina revelándola carácter por carácter
    if (segundosReal < 60) {
        if (porPatron) {
            // Débil por su estructura: nombres, palabras, secuencias, fechas...
            attackSpeed.textContent = 'ataque por patrones detectados';
            animarRevelado(pwd, alfabeto, Math.max(conjeturas, pwd.length), 1600, () => {
                marcarCrackeada(pwd, '¡ADIVINADA! › ');
                let mensaje = describirMatches(analisis) || traducirAdvertencia(analisis.feedback.warning || "");
                if (conSeparadores) mensaje += " (los espacios o separadores no ayudan)";
                escribirTexto(`¡CRACKEADO POR PATRÓN!<br>Tiempo estimado: ${formatearTiempo(segundosReal)}`, "texto-rojo");
                actualizarBarra(25, 'bg-rojo');
                mostrarMatch("⚠️ PATRÓN DÉBIL: " + escaparHtml(mensaje.toUpperCase()) + " ⚠️");
            });
        } else {
            // Débil por ser corta: fuerza bruta pura
            attackSpeed.textContent = 'fuerza bruta (generando combinaciones)';
            animarRevelado(pwd, alfabeto, intentosFuerzaBruta, 1800, () => {
                marcarCrackeada(pwd, '¡ADIVINADA! › ');
                escribirTexto(`¡CRACKEADO POR FUERZA BRUTA!<br>Tiempo estimado: ${formatearTiempo(segundosReal)}`, "texto-rojo");
                actualizarBarra(25, 'bg-rojo');
                mostrarMatch(`💥 DEMASIADO CORTA: ADIVINADA EN ${formatearNumero(intentosFuerzaBruta)} INTENTOS 💥`);
            });
        }
        return;
    }

    // 3) Resistió el ataque rápido: el veredicto final depende del tiempo real
    const intentosProbados = VELOCIDAD_GPU * 2; // lo que probaría en ~2 s
    animarAtaque(intentosProbados, muestraAleatoria, 2200, () => {
        ocultarMatch();
        attackTerminal.className = 'attack-terminal';
        if (segundosReal < 31536000) {
            attackStatus.textContent = '⬤ ATAQUE PARCIAL';
            attackStatus.className = 'attack-status run';
            attackStream.textContent = 'resistió el ataque rápido, pero es crackeable con tiempo';
        } else {
            attackStatus.textContent = '⬤ ATAQUE FALLIDO';
            attackStatus.className = 'attack-status fail';
            attackStream.textContent = 'resistió el ataque: espacio de búsqueda demasiado grande';
        }
        mostrarResultadoFuerzaBruta(segundosReal);
    });
}

// Deja la terminal en estado "crackeada" mostrando la contraseña adivinada.
function marcarCrackeada(pwd, prefijo) {
    attackStatus.textContent = '⬤ CLAVE ENCONTRADA';
    attackStatus.className = 'attack-status hit';
    attackStream.innerHTML = prefijo + '<strong>' + escaparHtml(pwd) + '</strong>';
    attackTerminal.className = 'attack-terminal cracked';
}

function mostrarResultadoFuerzaBruta(segundos) {
    const texto = formatearTiempo(segundos);
    const remate = comparacionHumana(segundos);
    const extra = remate ? `<br>≈ ${remate}` : '';
    let claseColor, porcentaje, etiqueta;

    if (segundos < 60) {
        claseColor = 'bg-rojo'; porcentaje = 25; etiqueta = 'Vulnerabilidad crítica';
        escribirTexto(`${etiqueta}.<br>Tiempo estimado: ${texto}`, 'texto-rojo');
    } else if (segundos < 31536000) {
        claseColor = 'bg-amarillo'; porcentaje = 65; etiqueta = 'Seguridad intermedia';
        escribirTexto(`${etiqueta}.<br>Tiempo estimado: ${texto}${extra}`, 'texto-amarillo');
    } else {
        claseColor = 'bg-verde'; porcentaje = 100; etiqueta = 'Seguridad máxima';
        escribirTexto(`${etiqueta}.<br>Tiempo estimado: ${texto}${extra}`, 'texto-verde');
    }
    actualizarBarra(porcentaje, claseColor);
}

// ====== Match display (alerta inferior) ======
function mostrarMatch(html) {
    matchDisplay.innerHTML = html;
    matchDisplay.className = 'match-display visible';
}
function ocultarMatch() {
    matchDisplay.className = 'match-display';
}

// ====== Barra de progreso ======
function actualizarBarra(porcentaje, claseColor) {
    progressBar.style.width = `${porcentaje}%`;
    progressBar.className = `progress-bar ${claseColor}`;
}

// ====== Efecto máquina de escribir para el resultado ======
let timeoutEscritura;
function escribirTexto(htmlTexto, claseColor) {
    clearTimeout(timeoutEscritura);
    resultText.className = `terminal-text ${claseColor}`;
    resultText.innerHTML = '';

    let i = 0;
    const textoPlano = htmlTexto.replace(/<br>/g, '\n');

    function teclear() {
        if (i < textoPlano.length) {
            let caracter = textoPlano.charAt(i) === '\n' ? '<br>' : textoPlano.charAt(i);
            resultText.innerHTML = resultText.innerHTML.replace('<span class="cursor"></span>', '') + caracter + '<span class="cursor"></span>';
            i++;
            timeoutEscritura = setTimeout(teclear, 15);
        }
    }
    teclear();
}

// ====== Estado inicial / reset ======
function resetear() {
    detenerAtaque();
    clearTimeout(timeoutDebounce);
    escribirTexto("Esperando input...", "");
    actualizarBarra(0, '');
    ocultarMatch();
    chips.forEach(chip => chip.classList.remove('on'));
    lenValue.textContent = '0';
    entropyValue.textContent = '0';
    attackTerminal.className = 'attack-terminal';
    attackStatus.textContent = '⬤ EN ESPERA';
    attackStatus.className = 'attack-status';
    attackSpeed.textContent = '';
    attackStream.textContent = 'Esperando input...';
    attackCount.textContent = '0';
}

// ====== Eventos ======
input.addEventListener('input', () => {
    const pwd = input.value;
    clearTimeout(timeoutDebounce);
    detenerAtaque();

    if (pwd.length === 0) {
        resetear();
        return;
    }

    // Feedback instantáneo y barato en cada tecla: chips + entropía
    const info = analizarCharset(pwd);
    actualizarChips(pwd, info);

    // Mientras escribe, la terminal queda "preparando ataque"
    attackStatus.textContent = '⬤ PREPARANDO...';
    attackStatus.className = 'attack-status';
    attackStream.textContent = 'esperando a que termines de escribir...';

    // El ataque pesado (zxcvbn + animación) espera a que deje de escribir
    timeoutDebounce = setTimeout(() => lanzarAtaque(pwd), 450);
});

clearBtn.addEventListener('click', () => {
    input.value = '';
    resetear();
    input.focus();
});
