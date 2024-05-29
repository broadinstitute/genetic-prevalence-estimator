export const isStructuralVariantId = (id: string, gnomadVersion: string) => {
  if (gnomadVersion === "4.1.0") {
    const svRegex = /^(BND|CPX|CTX|DEL|DUP|INS|INV|CNV)_CHR((1[0-9]|2[0-2]|[1-9])|X|Y)_([0-9a-f]*)$/i;
    return svRegex.test(id);
  } else if (gnomadVersion === "2.1.1") {
    const svRegex = /^(BND|CPX|CTX|DEL|DUP|INS|INV|CNV)_((1[0-9]|2[0-2]|[1-9])|X|Y)_([0-9a-f]*)$/i;
    return svRegex.test(id);
  }
  return false;
};
