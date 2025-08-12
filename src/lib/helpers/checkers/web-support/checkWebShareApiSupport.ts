export const checkWebShareApiSupport = (): boolean => {
  if (!navigator.share) return false;

  try {
    const testFile = new File(["test"], "test.pdf", {
      type: "application/pdf",
    });
    const shareData = { files: [testFile] };
    return navigator.canShare && navigator.canShare(shareData);
  } catch {
    return false;
  }
};
