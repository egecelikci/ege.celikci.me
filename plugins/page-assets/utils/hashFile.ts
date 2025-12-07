import crypto from "node:crypto";
import fs from "node:fs";

export default function fileHash(
  filename: string,
  algorithm = "md5",
  digest: crypto.BinaryToTextEncoding = "hex",
): Promise<string> {
  return new Promise((resolve, reject,) => {
    const shasum = crypto.createHash(algorithm,);
    try {
      const s = fs.createReadStream(filename,);
      s.on("data", function(data,) {
        shasum.update(data,);
      },);
      s.on("end", function() {
        const hash = shasum.digest(digest,);
        return resolve(hash,);
      },);
      s.on("error", function(err,) {
        reject(err,);
      },);
    } catch (error) {
      return reject(error,);
    }
  },);
}
