export const isStructuralVariantId = (id: string) => {
  const svRegex = /^(BND|CPX|CTX|DEL|DUP|INS|INV|CNV)_CHR((1[0-9]|2[0-2]|[1-9])|X|Y)_([0-9a-f]*)$/i;
  return svRegex.test(id);
};
