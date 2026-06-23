const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class ComicSourceBuilder {
    constructor() {
        this.userInput = {};
        this.currentStep = 0;
        this.testResults = {};
        this.report = [];
    }

    async start() {
        await this.collectBasicInfo();
        await this.runTests();
        await this.generateSource();
        await this.showReport();
    }

    async collectBasicInfo() {
        this.report.push({ type: 'info', message: '开始收集漫画源基本信息...' });
        
        this.userInput.url = await this.prompt('请输入漫画网站URL（必填）：');
        this.userInput.name = await this.prompt('请输入网站名称（可选，默认从URL提取）：', null, true);
        this.userInput.key = await this.prompt('请输入源Key（可选，默认小写网站名）：', null, true);
        this.userInput.version = await this.prompt('请输入版本号（可选，默认1.0.0）：', '1.0.0', true);
        this.userInput.needLogin = await this.prompt('是否需要登录？（y/n，默认n）：', 'n', true).then(v => v.toLowerCase() === 'y');
        this.userInput.backupDomains = await this.prompt('请输入备用域名（可选，逗号分隔）：', '', true).then(v => v ? v.split(',').map(s => s.trim()) : []);

        if (!this.userInput.name) {
            this.userInput.name = this.extractNameFromUrl(this.userInput.url);
        }
        if (!this.userInput.key) {
            this.userInput.key = this.userInput.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }

        this.report.push({ type: 'success', message: `已收集信息：${this.userInput.name} (${this.userInput.key})` });
    }

    extractNameFromUrl(url) {
        try {
            const u = new URL(url);
            return u.hostname.replace(/^(www\.)?/, '').replace(/\.[a-z]+$/, '');
        } catch {
            return 'comic_source';
        }
    }

    async prompt(message, defaultValue = null, allowEmpty = false) {
        return new Promise((resolve) => {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            readline.question(message, (answer) => {
                readline.close();
                if (answer.trim() === '' && allowEmpty) {
                    resolve(defaultValue);
                } else {
                    resolve(answer.trim() || defaultValue);
                }
            });
        });
    }

    async runTests() {
        this.report.push({ type: 'info', message: '\n开始运行测试...' });

        const pythonScript = path.join(__dirname, 'comic_source_tester.py');
        const args = [
            '--url', this.userInput.url,
            '--name', this.userInput.name,
            '--key', this.userInput.key,
            '--version', this.userInput.version,
            '--need-login', this.userInput.needLogin ? 'true' : 'false',
            '--backup-domains', this.userInput.backupDomains.join(',')
        ];

        return new Promise((resolve, reject) => {
            const child = exec(`python3 "${pythonScript}" ${args.join(' ')}`, (error, stdout, stderr) => {
                if (error) {
                    this.report.push({ type: 'error', message: `测试失败: ${error.message}` });
                    reject(error);
                } else {
                    try {
                        this.testResults = JSON.parse(stdout);
                        resolve();
                    } catch {
                        this.report.push({ type: 'error', message: '解析测试结果失败' });
                        reject(new Error('解析失败'));
                    }
                }
            });

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('[INFO]')) {
                        this.report.push({ type: 'info', message: line.slice(6) });
                    } else if (line.startsWith('[SUCCESS]')) {
                        this.report.push({ type: 'success', message: line.slice(10) });
                    } else if (line.startsWith('[WARNING]')) {
                        this.report.push({ type: 'warning', message: line.slice(10) });
                    } else if (line.startsWith('[ERROR]')) {
                        this.report.push({ type: 'error', message: line.slice(8) });
                    }
                });
            });
        });
    }

    async generateSource() {
        this.report.push({ type: 'info', message: '\n开始生成漫画源文件...' });

        const template = this.loadTemplate();
        let sourceCode = template;

        sourceCode = sourceCode.replace(/{{NAME}}/g, this.userInput.name);
        sourceCode = sourceCode.replace(/{{KEY}}/g, this.userInput.key);
        sourceCode = sourceCode.replace(/{{VERSION}}/g, this.userInput.version);
        sourceCode = sourceCode.replace(/{{URL}}/g, this.userInput.url);

        sourceCode = this.fillExploreSection(sourceCode);
        sourceCode = this.fillSearchSection(sourceCode);
        sourceCode = this.fillCategorySection(sourceCode);
        sourceCode = this.fillComicSection(sourceCode);

        const outputPath = path.join(process.cwd(), `${this.userInput.key}.js`);
        fs.writeFileSync(outputPath, sourceCode);

        this.report.push({ type: 'success', message: `漫画源文件已生成: ${outputPath}` });
        this.outputPath = outputPath;
    }

    loadTemplate() {
        return fs.readFileSync(path.join(__dirname, 'template.js'), 'utf8');
    }

    fillExploreSection(sourceCode) {
        if (!this.testResults.explore) return sourceCode;
        
        const exploreConfig = this.testResults.explore;
        let exploreCode = `    explore = [\n`;
        
        exploreConfig.sections.forEach(section => {
            exploreCode += `        {\n`;
            exploreCode += `            title: "${section.title}",\n`;
            exploreCode += `            type: "${section.type || 'multiPartPage'}",\n`;
            exploreCode += `            load: async (page) => {\n`;
            exploreCode += `                let res = await Network.get("${section.url}")\n`;
            exploreCode += `                if (res.status !== 200) throw "请求失败"\n`;
            exploreCode += `                let document = new HtmlDocument(res.body)\n`;
            exploreCode += `                let comics = []\n`;
            exploreCode += `                document.querySelectorAll("${section.selector}").forEach(el => {\n`;
            exploreCode += `                    comics.push(new Comic({\n`;
            exploreCode += `                        id: el.getAttribute("${section.idAttr}"),\n`;
            exploreCode += `                        title: el.querySelector("${section.titleSelector}")?.text || "",\n`;
            exploreCode += `                        cover: el.querySelector("${section.coverSelector}")?.getAttribute("${section.coverAttr}") || "",\n`;
            exploreCode += `                    }))\n`;
            exploreCode += `                })\n`;
            exploreCode += `                return { "${section.key}": comics }\n`;
            exploreCode += `            }\n`;
            exploreCode += `        }\n`;
        });
        
        exploreCode += `    ]\n`;
        
        return sourceCode.replace(/\{\{EXPLORE_SECTION\}\}/g, exploreCode);
    }

    fillSearchSection(sourceCode) {
        if (!this.testResults.search) return sourceCode;
        
        const searchConfig = this.testResults.search;
        const searchCode = `    search = {\n` +
            `        load: async (keyword, options, page) => {\n` +
            `            let url = "${searchConfig.url}".replace("{{keyword}}", encodeURIComponent(keyword))\n` +
            `            let res = await Network.get(url)\n` +
            `            if (res.status !== 200) throw "请求失败"\n` +
            `            let document = new HtmlDocument(res.body)\n` +
            `            let comics = []\n` +
            `            document.querySelectorAll("${searchConfig.selector}").forEach(el => {\n` +
            `                comics.push(new Comic({\n` +
            `                    id: el.getAttribute("${searchConfig.idAttr}"),\n` +
            `                    title: el.querySelector("${searchConfig.titleSelector}")?.text || "",\n` +
            `                    cover: el.querySelector("${searchConfig.coverSelector}")?.getAttribute("${searchConfig.coverAttr}") || "",\n` +
            `                }))\n` +
            `            })\n` +
            `            return { comics: comics, maxPage: 10 }\n` +
            `        }\n` +
            `    }\n`;
        
        return sourceCode.replace(/\{\{SEARCH_SECTION\}\}/g, searchCode);
    }

    fillCategorySection(sourceCode) {
        if (!this.testResults.category) return sourceCode;
        
        const categoryConfig = this.testResults.category;
        let categoryCode = `    category = {\n` +
            `        title: "分类",\n` +
            `        parts: [\n`;
        
        categoryConfig.categories.forEach(cat => {
            categoryCode += `            {\n` +
                `                name: "${cat.name}",\n` +
                `                type: "fixed",\n` +
                `                categories: [\n`;
            cat.items.forEach(item => {
                categoryCode += `                    {\n` +
                    `                        label: "${item.label}",\n` +
                    `                        target: {\n` +
                    `                            page: "category",\n` +
                    `                            attributes: { category: "${item.value}" }\n` +
                    `                        }\n` +
                    `                    },\n`;
            });
            categoryCode += `                ]\n` +
                `            },\n`;
        });
        
        categoryCode += `        ]\n` +
            `    }\n`;
        
        return sourceCode.replace(/\{\{CATEGORY_SECTION\}\}/g, categoryCode);
    }

    fillComicSection(sourceCode) {
        if (!this.testResults.comic) return sourceCode;
        
        const comicConfig = this.testResults.comic;
        const comicCode = `    comic = {\n` +
            `        loadInfo: async (id) => {\n` +
            `            let url = "${comicConfig.infoUrl}".replace("{{id}}", id)\n` +
            `            let res = await Network.get(url)\n` +
            `            if (res.status !== 200) throw "请求失败"\n` +
            `            let document = new HtmlDocument(res.body)\n` +
            `            let title = document.querySelector("${comicConfig.titleSelector}")?.text || ""\n` +
            `            let cover = document.querySelector("${comicConfig.coverSelector}")?.getAttribute("${comicConfig.coverAttr}") || ""\n` +
            `            let author = document.querySelector("${comicConfig.authorSelector}")?.text || ""\n` +
            `            let description = document.querySelector("${comicConfig.descSelector}")?.text || ""\n` +
            `            let chapters = []\n` +
            `            document.querySelectorAll("${comicConfig.chapterSelector}").forEach(el => {\n` +
            `                chapters.push(new Chapter({\n` +
            `                    id: el.getAttribute("${comicConfig.chapterIdAttr}"),\n` +
            `                    title: el.querySelector("${comicConfig.chapterTitleSelector}")?.text || "",\n` +
            `                }))\n` +
            `            })\n` +
            `            return new ComicDetails({\n` +
            `                id: id,\n` +
            `                title: title,\n` +
            `                cover: cover,\n` +
            `                author: author,\n` +
            `                description: description,\n` +
            `                chapters: chapters.reverse()\n` +
            `            })\n` +
            `        },\n` +
            `        loadEp: async (comicId, epId) => {\n` +
            `            let url = "${comicConfig.epUrl}".replace("{{comicId}}", comicId).replace("{{epId}}", epId)\n` +
            `            let res = await Network.get(url)\n` +
            `            if (res.status !== 200) throw "请求失败"\n` +
            `            let document = new HtmlDocument(res.body)\n` +
            `            let images = []\n` +
            `            document.querySelectorAll("${comicConfig.imageSelector}").forEach(el => {\n` +
            `                let src = el.getAttribute("${comicConfig.imageAttr}")\n` +
            `                if (src) images.push(src)\n` +
            `            })\n` +
            `            return { images: images }\n` +
            `        }\n` +
            `    }\n`;
        
        return sourceCode.replace(/\{\{COMIC_SECTION\}\}/g, comicCode);
    }

    async showReport() {
        console.log('\n' + '='.repeat(60));
        console.log('          漫画源生成报告');
        console.log('='.repeat(60));
        
        this.report.forEach(item => {
            let prefix = '  ';
            switch (item.type) {
                case 'success': prefix = '  ✅ '; break;
                case 'error': prefix = '  ❌ '; break;
                case 'warning': prefix = '  ⚠️ '; break;
                case 'info': prefix = '  ℹ️ '; break;
            }
            console.log(prefix + item.message);
        });
        
        console.log('='.repeat(60));
        if (this.outputPath) {
            console.log(`\n生成的源文件: ${this.outputPath}`);
        }
    }
}

if (require.main === module) {
    const builder = new ComicSourceBuilder();
    builder.start().catch(err => {
        console.error('生成失败:', err.message);
        process.exit(1);
    });
}

module.exports = ComicSourceBuilder;