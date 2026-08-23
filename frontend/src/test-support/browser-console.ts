const chromiumReadPixelsWarning = /^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/;

export function isKnownNonApplicationConsoleWarning(message: string): boolean {
  return message.includes("THREE.THREE.Clock: This module has been deprecated")
    || chromiumReadPixelsWarning.test(message);
}
