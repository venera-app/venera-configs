/** @type {import('./_venera_.js')} */

class Mhua5 extends ComicSource {
    name = "漫画5"
    key = "mhua5"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://www.mhua5.com"

    explore = [
        {
            title: "精品推荐",
            type: "multiPartPage",
            load: async (page) => {
                let res = await Network.get("https://www.mhua5.com/index.php/category/quality/39")
                if (res.status !== 200) throw "请求失败"
                let document = new HtmlDocument(res.body)
                let comics = []
                document.querySelectorAll("div.comic-item").forEach(el => {
                    comics.push(new Comic({
                        id: el.querySelector("a")?.getAttribute("href")?.replace("/index.php/comic/", "") || "",
                        title: el.querySelector("h3")?.text || "",
                        cover: el.querySelector("img")?.getAttribute("src") || "",
                    }))
                })
                return { "精品推荐": comics }
            }
        },
        {
            title: "上升最快",
            type: "multiPartPage",
            load: async (page) => {
                let res = await Network.get("https://www.mhua5.com/index.php/custom/ascension")
                if (res.status !== 200) throw "请求失败"
                let document = new HtmlDocument(res.body)
                let comics = []
                document.querySelectorAll("div.comic-item").forEach(el => {
                    comics.push(new Comic({
                        id: el.querySelector("a")?.getAttribute("href")?.replace("/index.php/comic/", "") || "",
                        title: el.querySelector("h3")?.text || "",
                        cover: el.querySelector("img")?.getAttribute("src") || "",
                    }))
                })
                return { "上升最快": comics }
            }
        },
        {
            title: "新作尝鲜",
            type: "multiPartPage",
            load: async (page) => {
                let res = await Network.get("https://www.mhua5.com/index.php/custom/update")
                if (res.status !== 200) throw "请求失败"
                let document = new HtmlDocument(res.body)
                let comics = []
                document.querySelectorAll("div.comic-item").forEach(el => {
                    comics.push(new Comic({
                        id: el.querySelector("a")?.getAttribute("href")?.replace("/index.php/comic/", "") || "",
                        title: el.querySelector("h3")?.text || "",
                        cover: el.querySelector("img")?.getAttribute("src") || "",
                    }))
                })
                return { "新作尝鲜": comics }
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            let url = "https://www.mhua5.com/index.php/search?keyword={{keyword}}".replace("{{keyword}}", encodeURIComponent(keyword))
            let res = await Network.get(url)
            if (res.status !== 200) throw "请求失败"
            let document = new HtmlDocument(res.body)
            let comics = []
            document.querySelectorAll("div.comic-item").forEach(el => {
                comics.push(new Comic({
                    id: el.querySelector("a")?.getAttribute("href")?.replace("/index.php/comic/", "") || "",
                    title: el.querySelector("h3")?.text || "",
                    cover: el.querySelector("img")?.getAttribute("src") || "",
                }))
            })
            return { comics: comics, maxPage: 10 }
        }
    }

    category = {
        title: "分类",
        parts: [
            {
                name: "精选分类",
                type: "fixed",
                categories: [
                    {
                        label: "精品推荐",
                        target: {
                            page: "category",
                            attributes: { category: "quality/39" }
                        }
                    },
                    {
                        label: "上升最快",
                        target: {
                            page: "category",
                            attributes: { category: "ascension" }
                        }
                    },
                    {
                        label: "新作尝鲜",
                        target: {
                            page: "category",
                            attributes: { category: "update" }
                        }
                    }
                ]
            }
        ]
    }

    comic = {
        loadInfo: async (id) => {
            let url = "https://www.mhua5.com/index.php/comic/{{id}}".replace("{{id}}", id)
            let res = await Network.get(url)
            if (res.status !== 200) throw "请求失败"
            let document = new HtmlDocument(res.body)
            let title = document.querySelector("h1")?.text || ""
            let cover = document.querySelector(".comic-cover img")?.getAttribute("src") || ""
            let author = document.querySelector(".author")?.text || ""
            let description = document.querySelector(".description")?.text || ""
            let chapters = []
            document.querySelectorAll(".chapter-list li a").forEach(el => {
                chapters.push(new Chapter({
                    id: el.getAttribute("href")?.replace("/index.php/chapter/", "") || "",
                    title: el?.text || "",
                }))
            })
            return new ComicDetails({
                id: id,
                title: title,
                cover: cover,
                author: author,
                description: description,
                chapters: chapters.reverse()
            })
        },
        loadEp: async (comicId, epId) => {
            let url = "https://www.mhua5.com/index.php/chapter/{{epId}}".replace("{{epId}}", epId)
            let res = await Network.get(url)
            if (res.status !== 200) throw "请求失败"
            let document = new HtmlDocument(res.body)
            let images = []
            document.querySelectorAll(".comic-content img").forEach(el => {
                let src = el.getAttribute("src")
                if (src) images.push(src)
            })
            return { images: images }
        }
    }
}