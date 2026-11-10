import os
from deep_translator import GoogleTranslator

print("Leyendo tu archivo de diccionarios existente...")

# Buscamos el archivo de contraseñas original que descargó Kaggle
path_kaggle = os.path.expanduser("~/.cache/kagglehub/datasets/joebeachcapital/top-10-million-passwords")
archivo_txt = None

if os.path.exists(path_kaggle):
    for root, dirs, files in os.walk(path_kaggle):
        for file in files:
            if file.endswith(".txt") or file.endswith(".csv"):
                archivo_txt = os.path.join(root, file)
                break

if not archivo_txt:
    print("No se encontró el archivo original de Kaggle automáticamente. Asegúrate de tenerlo o usa el diccionario base.")
else:
    print(f"Procesando contraseñas desde: {archivo_txt}")
    
    passwords_ingles = []
    with open(archivo_txt, 'r', encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f):
            if i == 0: continue
            if len(passwords_ingles) >= 50000: # Tomamos 50k en inglés y agregaremos las traducidas
                break
            pwd = line.strip()
            if "," in pwd:
                partes = pwd.split(",")
                pwd = partes[1] if len(partes) > 1 else partes[0]
            pwd = pwd.strip('"').strip()
            if pwd:
                passwords_ingles.append(pwd)

    # Palabras comunes en español que la gente suele usar y sus equivalentes directos
    palabras_espanol = [
        "contraseña", "perro", "gato", "princesa", "amor", "teamo", "familia", 
        "secreto", "maestria", "universidad", "estudiante", "trabajo", "sistema",
        "computadora", "teclado", "codigo", "programacion", "estrella", "fuego", "agua"
    ]

    print("Traduciendo términos comunes del español al inglés para unificar bases de datos...")
    traductor = GoogleTranslator(source='es', target='en')
    passwords_traducidas = []
    
    for palabra in palabras_espanol:
        try:
            traducida = traductor.translate(palabra)
            if traducida:
                passwords_traducidas.append(traducida.lower())
                # Agregamos variaciones comunes con números
                passwords_traducidas.append(f"{traducida.lower()}123")
                passwords_traducidas.append(f"{traducida.lower()}2026")
        except:
            pass

    # Unimos todo en una sola lista única
    diccionario_final = list(set(passwords_ingles + passwords_traducidas))

    print(f"Generando el archivo diccionario.js definitivo con {len(diccionario_final)} registros...")
    with open('diccionario.js', 'w', encoding='utf-8') as f:
        f.write('const diccionario = [\n')
        for i, p in enumerate(diccionario_final):
            safe_p = p.replace('"', '\\"')
            if i == len(diccionario_final) - 1:
                f.write(f'    "{safe_p}"\n')
            else:
                f.write(f'    "{safe_p}",\n')
        f.write('];\n')

    print("¡Listo! Tu diccionario.js ahora incluye contraseñas en inglés y sus traducciones automáticas.")