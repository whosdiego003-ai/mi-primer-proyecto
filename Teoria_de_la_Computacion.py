def validar_numero_decimal(cadena):
  if not cadena:
    return False

  estado = "INICIO"
  i = 0

  while i < len(cadena):
    c = cadena[i]

    if estado == "INICIO":
      if c in "+-":
        estado = "SIGN"
      elif c.isdigit():
        estado = "ENTERO"
      elif c == ".":
        estado = "PUNTO_SOLO"  # Caso .5
      else:
        return False

    elif estado == "SIGN":
      if c.isdigit():
        estado = "ENTERO"
      elif c == ".":
        estado = "PUNTO_SOLO"
      else:
        return False

    elif estado == "ENTERO":
      if c.isdigit():
        estado = "ENTERO"
      elif c == ".":
        estado = "PUNTO"
      else:
        return False

    elif estado == "PUNTO_SOLO" or estado == "PUNTO":
      if c.isdigit():
        estado = "DECIMAL"
      else:
        return False

    elif estado == "DECIMAL":
      if c.isdigit():
        estado = "DECIMAL"
      else:
        return False

    i += 1

  # Estados de aceptación válidos al finalizar la cadena
  return estado in ["ENTERO", "PUNTO", "DECIMAL"]


# --- Casos de prueba ---
casos_prueba = [
    "+123",
    "-45.67",
    "0",
    "78.",
    ".5",
    "12.34.56",
    "+--5",
    "abc",
    "12a",
]

print("--- Resultados Actividad 2 ---")
for caso in casos_prueba:
  resultado = "Aceptada" if validar_numero_decimal(caso) else "Rechazada"
  print(f"Cadena: {casos_prueba.index(caso) + 1:2d} | '{caso}' -> {resultado}")