/** @type {import('./_venera_.js')} */

class Mhua5 extends ComicSource {
    name = "漫画5"
    key = "mhua5"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://www.mhua5.com"

    explore = [
        {
            title: "推荐",
            type: "multiPartPage",
            load: async (page) => {
                let res = await Network.get("https://www.mhua5.com")
                if (res.status !== 200) throw "请求失败"
                let document = new HtmlDocument(res.body)
                let comics = []
                document.querySelectorAll("li.comic-item").forEach(el => {
                    comics.push(new Comic({
                        id: el.querySelector("a")?.getAttribute("href")?.replace("/index.php/comic/", "") || "",
                        title: el.querySelector("a")?.text || "",
                        cover: el.querySelector("img")?.getAttribute("src") || "",
                    }))
                })
                return { "推荐": comics }
            }
        }
    ]

    comic = {
        loadInfo: async (id) => {
            let url = "https://www.mhua5.com/index.php/comic/" + id
            let res = await Network.get(url)
            if (res.status !== 200) throw "请求失败"
            let document = new HtmlDocument(res.body)
            let title = document.querySelector("h1")?.text || ""
            let cover = document.querySelector("img")?.getAttribute("src") || ""
            let author = document.querySelector(".author")?.text || ""
            let description = document.querySelector(".desc")?.text || ""
            let chapters = []
            document.querySelectorAll("ul.chapters li a, div.chapters a, .chapter-list a, ul.list li a").forEach(el => {
                let href = el.getAttribute("href")
                if (href) {
                    chapters.push(new Chapter({
                        id: href.replace("/index.php/chapter/", ""),
                        title: el?.text || "",
                    }))
                }
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
            let url = "https://www.mhua5.com/index.php/chapter/" + epId
            let res = await Network.get(url)
            if (res.status !== 200) throw "请求失败"
            let document = new HtmlDocument(res.body)
            let images = []
            document.querySelectorAll("div.images img, div.content img, .comic-image img, img.lazy, img[data-src], article img").forEach(el => {
                let src = el.getAttribute("data-src") || el.getAttribute("src")
                if (src) images.push(src)
            })
            return { images: images }
        }
    }
}