import kagglehub
import os

print("Descargando dataset desde Kaggle (esto puede tardar un momento)...")
path = kagglehub.dataset_download("joebeachcapital/top-10-million-passwords")

archivos_descargados = os.listdir(path)

archivo_encontrado = None
for file in archivos_descargados:
    if file.endswith(".txt") or file.endswith(".csv"):
        archivo_encontrado = os.path.join(path, file)
        break

if not archivo_encontrado:
    print("Error: No se encontró ningún archivo .txt o .csv válido.")
else:
    print(f"Procesando el archivo: {file}...")
    
    passwords = []
    with open(archivo_encontrado, 'r', encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f):
            # Saltar el encabezado
            if i == 0:
                continue
            
            # Detenerse al llegar a 100,000
            if len(passwords) >= 100000:
                break
                
            pwd = line.strip()
            
            # El archivo CSV tiene el formato: numero,contraseña
            # Aquí lo dividimos y tomamos la SEGUNDA parte (índice 1)
            if file.endswith(".csv") and "," in pwd:
                partes = pwd.split(",")
                pwd = partes[1] if len(partes) > 1 else partes[0]
            
            # Limpiar comillas residuales
            pwd = pwd.strip('"').strip()
            
            if pwd:
                passwords.append(pwd)

    print("Generando el archivo diccionario.js...")
    with open('diccionario.js', 'w', encoding='utf-8') as f:
        f.write('const diccionario = [\n')
        for i, p in enumerate(passwords):
            safe_p = p.replace('"', '\\"')
            if i == len(passwords) - 1:
                f.write(f'    "{safe_p}"\n')
            else:
                f.write(f'    "{safe_p}",\n')
        f.write('];\n')

    print(f"¡Éxito! Se han guardado {len(passwords)} contraseñas reales en diccionario.js")