
const fs = require("fs");
const path = require("path");

const countRegex = (regex, dir) => {
    let counts = {};
    const traverse = (currentDir) => {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                traverse(fullPath);
            } else if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
                const content = fs.readFileSync(fullPath, "utf-8");
                let match;
                while ((match = regex.exec(content)) !== null) {
                    const matchedStr = match[0];
                    counts[matchedStr] = (counts[matchedStr] || 0) + 1;
                }
            }
        }
    };
    traverse(dir);
    return counts;
};

const roundedCounts = countRegex(/rounded-(sm|md|lg|xl|2xl|3xl|full|none)/g, "./src");
const shadowCounts = countRegex(/shadow(-sm|-md|-lg|-xl|-2xl|-none|)/g, "./src");
const paddingCounts = countRegex(/\b(p-[0-9]+)\b/g, "./src");
const gapCounts = countRegex(/\b(gap-[0-9]+)\b/g, "./src");
const textCounts = countRegex(/\b(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|\[10px\]|\[11px\]|\[13px\]))\b/g, "./src");
const weightCounts = countRegex(/\b(font-(light|normal|medium|semibold|bold|extrabold|black))\b/g, "./src");

console.log("Rounded:", Object.entries(roundedCounts).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Shadow:", Object.entries(shadowCounts).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Padding:", Object.entries(paddingCounts).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Gap:", Object.entries(gapCounts).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Text:", Object.entries(textCounts).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Font Weight:", Object.entries(weightCounts).sort((a,b)=>b[1]-a[1]).slice(0,10));

