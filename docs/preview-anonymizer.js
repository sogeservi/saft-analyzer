// Cole na consola das ferramentas de programador depois de abrir o painel de resultados.
// Introduza os valores da empresa, clientes, fornecedores, impostos, moradas,
// contactos e documentos, um por linha. A alteração limita-se à página atual;
// atualize-a para repor os valores.
(() => {
  const input = window.prompt(
    "Introduza os valores privados a ocultar, exatamente como aparecem, um por linha:",
  );
  if (input === null) return;

  const privateValues = [...new Set(input.split(/\r?\n/).map((value) => value.trim()))]
    .filter((value) => value.length >= 3)
    .sort((left, right) => right.length - left.length);

  if (privateValues.length === 0) {
    console.info("Não foram indicados valores. A página não foi alterada.");
    return;
  }

  let replacements = 0;
  const escapedValues = privateValues.map((value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const privateValuePattern = new RegExp(escapedValues.join("|"), "g");
  const mask = (source) => source.replace(privateValuePattern, () => {
    replacements += 1;
    return "[OCULTADO]";
  });

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const updated = mask(node.nodeValue ?? "");
    if (updated !== node.nodeValue) node.nodeValue = updated;
  }

  for (const element of document.body.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      const updated = mask(attribute.value);
      if (updated !== attribute.value) attribute.value = updated;
    }

    if (element instanceof HTMLInputElement && element.type !== "file" && element.type !== "password") {
      const updated = mask(element.value);
      if (updated !== element.value) element.value = updated;
    } else if (element instanceof HTMLTextAreaElement) {
      const updated = mask(element.value);
      if (updated !== element.value) element.value = updated;
    }
  }

  console.info(`${replacements} valor(es) ocultado(s) no texto ou nos atributos visíveis. Atualize a página para repor os valores.`);
})();
