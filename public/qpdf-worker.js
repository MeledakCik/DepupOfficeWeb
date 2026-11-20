importScripts("/runtime/qpdf/qpdf.js");
self.onmessage = async ({ data }) => {
  try {
    const messages = [];
    const qpdf = await Module({
      noInitialRun: true,
      locateFile: () => "/runtime/qpdf/qpdf.wasm",
      print: () => {},
      printErr: (message) => messages.push(message),
    });
    qpdf.FS.writeFile("/input.pdf", new Uint8Array(data.input));
    qpdf.callMain([...data.args, "/input.pdf", "/output.pdf"]);
    const output = qpdf.FS.readFile("/output.pdf").slice();
    if (!output.length) throw new Error(messages.join(" "));
    self.postMessage({ output }, [output.buffer]);
  } catch {
    self.postMessage({ error: "PDF gagal diproses. Periksa berkas dan kata sandinya." });
  }
};
