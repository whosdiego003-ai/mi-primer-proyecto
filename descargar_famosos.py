import hashlib
import json
import os
import re
import time
import unicodedata

import requests

# Descarga desde Wikidata nombres de redes sociales, influencers, celebridades,
# personajes, bandas, películas, series, videojuegos, Pokémon, equipos y
# usuarios de redes (@...), y genera famosos.js para que el simulador detecte
# contraseñas basadas en ellos.
# "sitelinks" = en cuántas Wikipedias aparece: sirve como medida de fama.

ENDPOINTS = ["https://qlever.dev/api/wikidata", "https://query.wikidata.org/sparql"]
CACHE = "cache_famosos"

URL_PALABRAS = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt"
PALABRAS_ESPANOL = 8000

PREFIJOS = """
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
"""

# De dónde sale ?nombre: por defecto, el nombre y los alias en español/inglés
ETIQUETAS = """{ ?item rdfs:label ?nombre } UNION { ?item skos:altLabel ?nombre }
  FILTER(LANG(?nombre) = "es" || LANG(?nombre) = "en")"""

# Nombres de usuario en redes: Instagram, X/Twitter, TikTok, Twitch, YouTube (@handle)
USUARIOS = """{ ?item wdt:P2003 ?nombre } UNION { ?item wdt:P2002 ?nombre }
  UNION { ?item wdt:P7085 ?nombre } UNION { ?item wdt:P5797 ?nombre }
  UNION { ?item wdt:P11245 ?nombre }"""

# YouTubers, streamers, influencers y tiktokers
INFLUENCERS = """?item wdt:P31 wd:Q5 . ?item wdt:P106 ?oficio .
  VALUES ?oficio { wd:Q17125263 wd:Q57414145 wd:Q2906862 wd:Q94791573 }"""

# Redes sociales que siempre se incluyen, aunque falle la descarga
REDES_SOCIALES = [
    "facebook", "instagram", "tiktok", "twitter", "youtube", "whatsapp",
    "snapchat", "discord", "twitch", "reddit", "pinterest", "telegram",
    "linkedin", "threads", "kick", "onlyfans", "tumblr", "messenger",
    "bereal", "wechat", "weibo", "vimeo", "spotify", "netflix", "roblox",
    "fortnite", "minecraft", "steam", "xbox", "playstation", "google",
    "gmail", "hotmail", "outlook", "yahoo", "icloud", "skype", "zoom",
    "myspace", "hi5", "metroflog", "fotolog", "tinder", "bumble", "grindr",
    "clubhouse", "mastodon", "bluesky", "patreon", "soundcloud", "deezer",
    "shein", "temu", "amazon", "mercadolibre", "uber", "didi", "rappi",
]

# (categoría, patrón SPARQL que define ?item, sitelinks mínimos[, de dónde sale ?nombre])
CONSULTAS = [
    # Redes sociales y plataformas en línea
    ("redsocial", "?item wdt:P31/wdt:P279* wd:Q202833 .", 5),
    # Personajes de ficción (cómics, caricaturas, anime, películas, videojuegos...)
    ("personaje", "?item wdt:P31/wdt:P279* wd:Q95074 .", 6),
    # Celebridades de todo el mundo (actores, cantantes, deportistas, históricos...)
    ("celebridad", "?item wdt:P31 wd:Q5 .", 45),
    # Celebridades mexicanas: umbral más bajo para cubrir famosos locales
    ("celebridad", "?item wdt:P31 wd:Q5 . ?item wdt:P27 wd:Q96 .", 6),
    # Bandas y grupos musicales
    ("banda", "?item wdt:P31/wdt:P279* wd:Q215380 .", 15),
    # Franquicias (Star Wars, Marvel, Harry Potter...)
    ("franquicia", "?item wdt:P31/wdt:P279* wd:Q196600 .", 10),
    # Películas
    ("pelicula", "?item wdt:P31 wd:Q11424 .", 35),
    # Series de TV (incluye anime y telenovelas)
    ("serie", "?item wdt:P31/wdt:P279* wd:Q5398426 .", 20),
    # Videojuegos
    ("videojuego", "?item wdt:P31 wd:Q7889 .", 20),
    # Clubes de fútbol del mundo y todos los de México
    ("equipo", "?item wdt:P31 wd:Q476028 .", 30),
    ("equipo", "?item wdt:P31 wd:Q476028 . ?item wdt:P17 wd:Q96 .", 0),
    # Influencers: YouTubers, streamers, tiktokers... (incluye muchos poco
    # conocidos, por eso van después de las categorías principales)
    ("influencer", INFLUENCERS, 2),
    # Usuarios en redes (@...) de influencers y celebridades del mundo y de México.
    # Van al final para que los nombres ya conocidos conserven su categoría.
    ("usuario", INFLUENCERS, 2, USUARIOS),
    ("usuario", "?item wdt:P31 wd:Q5 .", 25, USUARIOS),
    ("usuario", "?item wdt:P31 wd:Q5 . ?item wdt:P27 wd:Q96 .", 3, USUARIOS),
]

# Palabras de relleno que no aportan como "nombre" por sí solas
VACIAS = {
    "de", "del", "la", "las", "los", "el", "y", "e", "the", "of", "and", "von",
    "van", "der", "den", "da", "di", "do", "dos", "du", "le", "les", "jr", "sr",
    "san", "santa", "club", "futbol", "football", "season", "temporada", "part",
    "parte", "film", "pelicula", "serie", "series", "game", "juego", "with",
}

LONGITUD_MAX = 25


def normalizar(texto):
    # Quita acentos y deja minúsculas: "Pokémon" -> "pokemon"
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def tokens_de(nombre):
    # Quita aclaraciones entre paréntesis: "Link (The Legend of Zelda)" -> "Link"
    nombre = re.sub(r"\(.*?\)", " ", nombre)
    nombre = normalizar(nombre)
    partes = [p for p in re.split(r"[^a-z0-9]+", nombre) if p]
    if not partes:
        return []

    # Devuelve (palabra, prioridad): 1 = nombre completo, 2 = solo una parte
    resultado = []
    completo = "".join(partes)
    if 3 <= len(completo) <= LONGITUD_MAX:
        resultado.append((completo, 1))                  # "lionelmessi"
    if len(partes) >= 3:
        resultado.append((partes[0] + partes[-1], 1))    # "lionelmessi" de "lionel andres messi"
    if len(partes) >= 2:
        for p in partes:
            if len(p) >= 4 and p not in VACIAS:
                resultado.append((p, 2))                 # "lionel", "messi"
    return [(t, prio) for t, prio in resultado if not t.isdigit()]


def consultar(patron, minimo, nombres=ETIQUETAS):
    # Cada consulta ya descargada se guarda en cache_famosos/ para no repetirla
    # si el script se vuelve a correr (borra la carpeta para actualizar todo).
    os.makedirs(CACHE, exist_ok=True)
    llave = f"{patron}|{minimo}" if nombres == ETIQUETAS else f"{patron}|{minimo}|{nombres}"
    clave = hashlib.md5(llave.encode()).hexdigest()
    ruta_cache = os.path.join(CACHE, clave + ".json")
    if os.path.exists(ruta_cache):
        print("   (desde caché)")
        with open(ruta_cache, encoding="utf-8") as f:
            return json.load(f)

    filas = descargar(patron, minimo, nombres)
    if filas:
        with open(ruta_cache, "w", encoding="utf-8") as f:
            json.dump(filas, f, ensure_ascii=False)
    return filas


def descargar(patron, minimo, nombres):
    query = PREFIJOS + f"""
SELECT ?item ?sl ?nombre WHERE {{
  {patron}
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl >= {minimo})
  {nombres}
}} ORDER BY DESC(?sl) LIMIT 400000
"""
    # Los servidores limitan peticiones seguidas (error 429): alternamos entre
    # QLever y el servidor oficial de Wikidata, esperando cada vez más
    for intento in range(6):
        endpoint = ENDPOINTS[intento % len(ENDPOINTS)]
        try:
            r = requests.get(endpoint, params={"query": query}, timeout=300, headers={
                "Accept": "application/sparql-results+json",
                "User-Agent": "ProyectoUCFest/1.0 (simulador educativo de contrasenas)",
            })
            r.raise_for_status()
            return [{"nombre": b["nombre"]["value"]} for b in r.json()["results"]["bindings"]]
        except Exception as e:
            codigo = getattr(getattr(e, "response", None), "status_code", type(e).__name__)
            espera = 20 * (intento + 1)
            print(f"   Error {codigo} en {endpoint.split('/')[2]}, reintentando en {espera} s...")
            time.sleep(espera)
    print("   No se pudo descargar esta categoría, se omite.")
    return []


# Cada palabra se queda con UNA categoría: la de mayor prioridad (0 = listas
# fijas, 1 = nombre completo, 2 = parte de un nombre) y, si empatan, la primera
# en aparecer. Así "goku" es personaje (nombre completo) aunque también sea
# parte del nombre de alguna persona.
asignado = {}   # palabra -> [categoría, prioridad]
orden = []      # palabras en el orden en que aparecieron (de más a menos famosas)


def agregar(palabra, categoria, prioridad):
    if palabra not in asignado:
        asignado[palabra] = [categoria, prioridad]
        orden.append(palabra)
        return True
    if prioridad < asignado[palabra][1]:
        asignado[palabra] = [categoria, prioridad]
    return False


for red in REDES_SOCIALES:
    agregar(red, "redsocial", 0)

# Palabras más usadas del español (subtítulos de películas/series, OpenSubtitles),
# para detectar frases como "te amo mucho" o "juan ama a maria"
print(f"Descargando las {PALABRAS_ESPANOL} palabras más usadas del español...")
try:
    r = requests.get(URL_PALABRAS, timeout=60)
    r.raise_for_status()
    nuevas = 0
    for linea in r.text.splitlines()[:PALABRAS_ESPANOL]:
        palabra = normalizar(linea.split(" ")[0])
        if len(palabra) >= 2 and palabra.isalpha():
            nuevas += agregar(palabra, "palabra", 0)
    print(f"   {nuevas} palabras")
except Exception as e:
    print(f"   No se pudieron descargar ({e}), se omiten.")

# Pokémon: todas las especies desde PokeAPI (más completo que Wikidata)
print("Descargando Pokémon desde PokeAPI...")
try:
    r = requests.get("https://pokeapi.co/api/v2/pokemon-species?limit=2000", timeout=60)
    r.raise_for_status()
    nuevas = 0
    for especie in r.json()["results"]:
        for token, _ in tokens_de(especie["name"]):
            nuevas += agregar(token, "pokemon", 1)
    print(f"   {nuevas} palabras nuevas")
except Exception as e:
    print(f"   No se pudieron descargar ({e}), se omiten.")

for categoria, patron, minimo, *nombres in CONSULTAS:
    print(f"Descargando {categoria} (sitelinks >= {minimo})...")
    filas = consultar(patron, minimo, *nombres)
    nuevas = 0
    for fila in filas:
        for token, prioridad in tokens_de(fila["nombre"]):
            nuevas += agregar(token, categoria, prioridad)
    print(f"   {len(filas)} nombres -> {nuevas} palabras nuevas")
    if filas:
        time.sleep(10)  # pausa de cortesía entre consultas

categorias = {}
for palabra in orden:
    categorias.setdefault(asignado[palabra][0], []).append(palabra)

print("Generando el archivo famosos.js...")
with open("famosos.js", "w", encoding="utf-8") as f:
    f.write("// Generado por descargar_famosos.py desde Wikidata. No editar a mano.\n")
    f.write("// Redes sociales, influencers, celebridades, personajes, bandas, películas,\n")
    f.write("// series, videojuegos, Pokémon, equipos y usuarios de redes, ordenados de\n")
    f.write("// más a menos famosos por categoría.\n")
    f.write("const famosos = {\n")
    for categoria, lista in categorias.items():
        f.write(f"    {json.dumps(categoria)}: {json.dumps(lista, ensure_ascii=False)},\n")
    f.write("};\n")

print(f"¡Éxito! Se guardaron {len(orden)} palabras en famosos.js")
