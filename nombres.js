// Lista de nombres, apellidos y palabras comunes en español.
// Se le pasa a zxcvbn como "user_inputs" para que detecte contraseñas basadas
// en nombres (sueltos, dos nombres juntos, con años, con espacios, etc.).
const nombresComunes = [
    // --- Nombres masculinos ---
    "juan", "jose", "luis", "carlos", "jorge", "miguel", "antonio", "francisco",
    "javier", "daniel", "david", "pedro", "pablo", "diego", "alejandro", "manuel",
    "rafael", "fernando", "sergio", "andres", "ricardo", "roberto", "eduardo",
    "oscar", "raul", "victor", "hugo", "mario", "alberto", "ramon", "ruben",
    "ivan", "gabriel", "marcos", "adrian", "angel", "cristian", "emilio", "felipe",
    "gonzalo", "ignacio", "martin", "nicolas", "santiago", "sebastian", "tomas",
    "enrique", "esteban", "gerardo", "guillermo", "hector", "humberto", "joaquin",
    "lorenzo", "lucas", "mateo", "rodrigo", "salvador", "vicente", "benjamin",
    "bruno", "elias", "emmanuel", "julian", "leonardo", "matias", "valentin",

    // --- Nombres femeninos ---
    "maria", "ana", "laura", "carmen", "isabel", "patricia", "sofia", "lucia",
    "paula", "marta", "elena", "cristina", "sara", "andrea", "rosa", "pilar",
    "raquel", "beatriz", "julia", "claudia", "natalia", "alba", "irene", "silvia",
    "veronica", "alicia", "angela", "antonia", "blanca", "camila", "carla",
    "carolina", "catalina", "clara", "daniela", "diana", "emma", "eva", "fatima",
    "fernanda", "gabriela", "gloria", "ines", "juana", "leticia", "manuela",
    "margarita", "mariana", "martina", "mercedes", "monica", "nerea", "nuria",
    "rocio", "rosario", "susana", "teresa", "valentina", "valeria", "victoria",
    "ximena", "yolanda", "adriana", "alejandra", "aurora", "barbara", "celia",
    "florencia", "guadalupe", "jose", "maria",

    // --- Nombres compuestos frecuentes ---
    "josemaria", "mariajose", "juancarlos", "juanjose", "juanpablo", "mariafernanda",
    "mariajose", "anamaria", "luisfernando", "josemanuel", "joseluis", "mariadolores",

    // --- Apellidos comunes ---
    "garcia", "rodriguez", "gonzalez", "fernandez", "lopez", "martinez", "sanchez",
    "perez", "gomez", "jimenez", "ruiz", "hernandez", "diaz", "moreno", "alvarez",
    "romero", "alonso", "gutierrez", "navarro", "torres", "dominguez", "vazquez",
    "ramos", "gil", "ramirez", "serrano", "blanco", "molina", "morales", "suarez",
    "ortega", "delgado", "castro", "ortiz", "rubio", "nunez", "medina", "castillo",
    "santos", "guerrero", "cruz", "flores", "herrera", "vargas", "reyes", "aguilar",
    "rojas", "silva", "mendoza", "leon",

    // --- Palabras y equipos/lugares que la gente usa de contraseña ---
    "contraseña", "clave", "amor", "teamo", "familia", "hola", "casa", "perro",
    "gato", "futbol", "madrid", "barcelona", "america", "chivas", "mexico",
    "argentina", "colombia", "españa", "verano", "estrella", "princesa", "reina",
    "campeon", "dios", "jesus", "fuego", "agua", "sol", "luna", "cielo", "corazon",
    "bebe", "mama", "papa", "hermano", "amigo", "trabajo", "dinero", "feliz",
    "vida", "libertad", "universidad", "estudiante",

    // --- Nombres comunes en México/Jalisco ---
    "guadalupe", "lupita", "lupe", "chuy", "jesus", "memo", "pancho", "toño",
    "beto", "checo", "moises", "abraham", "isaias", "josue", "uriel", "axel",
    "kevin", "brandon", "jonathan", "yahir", "emiliano", "dylan", "derek",
    "cristopher", "alexis", "ramiro", "everardo", "efrain", "rigoberto",
    "dulce", "brenda", "karla", "mayra", "yesenia", "alondra", "citlali",
    "xochitl", "montserrat", "montse", "regina", "renata", "danna", "allison",
    "ashley", "itzel", "nayeli", "abril", "perla", "jatziri", "yaretzi",

    // --- Apellidos frecuentes en Jalisco ---
    "orozco", "zepeda", "curiel", "barajas", "becerra", "cervantes",
    "covarrubias", "iniguez", "limon", "llamas", "murillo", "padilla",
    "plascencia", "preciado", "quezada", "robles", "saldaña", "tapia",
    "uribe", "velazquez", "villaseñor", "zamora", "zuniga", "chavez",
    "delatorre", "delarosa", "gallo", "michel", "partida", "venegas",

    // --- Lugares de Jalisco ---
    "jalisco", "guadalajara", "gdl", "zapopan", "tlaquepaque", "tonala",
    "tlajomulco", "vallarta", "puertovallarta", "chapala", "ajijic", "tequila",
    "ocotlan", "tepatitlan", "arandas", "autlan", "ameca", "lagos", "zapotlan",
    "mexico", "mexicana", "mexicano", "aztecas",

    // --- Equipos y cultura tapatía ---
    "chivas", "chivasrayadas", "rebaño", "rebano", "atlas", "rojinegros",
    "leones", "tequila", "mariachi", "charro", "charreria", "tapatio",
    "tapatia", "agave", "birria", "tejuino", "cantaritos", "jarabe",

    // --- Apodos comunes (México) ---
    "guero", "guera", "flaco", "flaca", "gordo", "gorda", "negro", "negra",
    "chaparro", "chaparra", "moreno", "chino", "pelon", "pelona", "chato",
    "chava", "chavo", "morro", "morra", "chamaco", "nene", "nena", "chiquis",
    "mija", "mijo", "compa", "carnal", "cuate", "wey", "guey", "vato", "ñero",
    "jefe", "jefa", "viejo", "vieja", "osito", "gordito", "flaquita", "bebe",
    "amorcito", "chikis", "primo", "bro", "chido",
    // Apodos de nombres
    "nacho", "poncho", "lalo", "chayo", "tere", "paco", "pepe", "quique",
    "goyo", "chema", "maru", "mayte", "charo", "lola", "cuco", "chucho",
    "tavo", "nando", "licha", "cande", "fito", "kiko", "moncho",

    // --- Groserías/slang que se usan como contraseña ---
    "pendejo", "pendeja", "cabron", "cabrona", "chinga", "chingada", "chingon",
    "chingona", "verga", "pinche", "puto", "puta", "culero", "culera", "mamon",
    "mamona", "nomames", "pedo", "culo", "nalgas", "joto", "mierda", "caca",
    "idiota", "estupido", "imbecil", "menso", "tonto", "baboso", "naco",
    "chafa", "gacho", "perra", "zorra", "chale", "orale", "pelmazo"
];
