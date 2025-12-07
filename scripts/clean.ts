import { emptyDir, } from "@std/fs";

console.log("Cleaning dist...",);
await emptyDir("./dist",);
console.log("Done.",);
