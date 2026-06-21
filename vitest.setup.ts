// jsdom does not implement Blob.prototype.text() / File.prototype.text(), which
// the real Electron/Chromium runtime provides. Polyfill it (via FileReader) so
// the parsers, which read uploaded files with file.text(), can be unit-tested.
if (typeof Blob !== "undefined" && typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
