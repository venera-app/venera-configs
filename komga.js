/** @type {import('./_venera_.js')} */
class Komga extends ComicSource {
	name = "Komga"

	key = "komga"

	version = "1.0.0"

	minAppVersion = "1.4.0"

	url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/komga.js"

	settings = {
		base_url: {
			title: "服务器地址",
			type: "input",
			default: "https://demo.komga.org",
			validator: "^(https?:\\/\\/).+$"
		},
		// default_username: {
		// 	title: "默认账号",
		// 	type: "input",
		// 	default: "demo@komga.org"
		// },
		// default_password: {
		// 	title: "默认密码",
		// 	type: "input",
		// 	default: "komga-demo"
		// }
	}

	get baseUrl() {
		let raw = this.loadSetting('base_url')
		if (typeof raw !== 'string' || !raw.trim()) {
			raw = this.settings.base_url.default
		}
		let value = raw.trim()
		if (!/^https?:\/\//i.test(value)) {
			value = `https://${value}`
		}
		return value.replace(/\/$/, '')
	}

	get authToken() {
		const stored = this.loadData('komga_auth')
		if (stored) {
			return stored
		}
		const username = this.loadSetting('default_username')
		const password = this.loadSetting('default_password')
		if (!username || !password) {
			return null
		}
		const encoded = Convert.encodeBase64(Convert.encodeUtf8(`${username}:${password}`))
		return typeof encoded === 'string' ? encoded : Convert.decodeUtf8(encoded)
	}

	get headers() {
		const headers = { "Accept": "application/json" }
		const token = this.authToken
		if (token) headers["Authorization"] = `Basic ${token}`
		return headers
	}

	get imageHeaders() {
		const token = this.authToken
		return token ? { "Authorization": `Basic ${token}` } : {}
	}

	async init() {
		try {
			await this.refreshReferenceData(false)
		} catch (_) {
		}
	}

	account = {
		login: async (account, pwd) => {
			if (!account || !pwd) {
				throw '账号或密码不能为空'
			}
			const basic = Convert.encodeBase64(Convert.encodeUtf8(`${account}:${pwd}`))
			const token = typeof basic === 'string' ? basic : Convert.decodeUtf8(basic)
			const res = await Network.get(
				this.buildUrl('/api/v2/users/me'),
				{
					"Accept": "application/json",
					"Authorization": `Basic ${token}`
				}
			)
			if (res.status === 401) {
				throw '账号或密码错误'
			}
			if (res.status !== 200) {
				throw `登录失败: ${res.status}`
			}
			this.saveData('komga_auth', token)
			this.saveData('komga_account_email', account)
			await this.refreshReferenceData(true)
			return account
		},
		logout: () => {
			this.deleteData('komga_auth')
			this.deleteData('komga_account_email')
			this.deleteData('komga_libraries')
			this.deleteData('komga_tags')
			this.deleteData('komga_genres')
			this.deleteData('komga_languages')
			this.deleteData('komga_collections')
			this.deleteData('komga_meta_ts')
		},
		registerWebsite: null
	}

	explore = [
		{
			title: "Komga",
			type: "singlePageWithMultiPart",
			load: async () => {
				await this.refreshReferenceData(false)
				const feeds = {}
				const latest = await this.fetchSeriesList('/api/v1/series/latest', { size: 12, page: 0 })
				if (latest.comics.length) feeds["最新上架"] = latest.comics
				const updated = await this.fetchSeriesList('/api/v1/series/updated', { size: 12, page: 0 })
				if (updated.comics.length) feeds["最近更新"] = updated.comics
				const libraries = this.loadData('komga_libraries')
				if (Array.isArray(libraries)) {
					for (const library of libraries.slice(0, 4)) {
						const list = await this.fetchSeriesList('/api/v1/series', {
							page: 0,
							size: 12,
							sort: ['metadata.lastModified,desc'],
							library_id: [library.id]
						})
						if (list.comics.length) feeds[`书库 ${library.name}`] = list.comics
					}
				}
				if (!Object.keys(feeds).length) {
					throw '未找到可展示的数据，请确认已登录且服务器可用'
				}
				return feeds
			}
		}
	]

	category = {
		title: "Komga",
		parts: [
			{
				name: "常用",
				type: "dynamic",
				loader: () => (
					[
						{
							label: "all",
							target: {
								page: 'category',
								attributes: {
									category: 'all',
									param: null,
								},
							},
						}
					]
				)
			},
			{
				name: "书库",
				type: "dynamic",
				loader: () => {
					const libraries = this.loadData('komga_libraries')
					if (!Array.isArray(libraries) || !libraries.length) {
						return []
					}
					return libraries.map((library) => ({
						label: library.name,
						target: {
							page: 'category',
							attributes: {
								category: 'library',
								param: library.id,
							},
						},
					}))
				}
			},
			{
				name: "合集",
				type: "dynamic",
				loader: () => {
					const collections = this.loadData('komga_collections')
					if (!Array.isArray(collections) || !collections.length) {
						return []
					}
					return collections.map((collection) => ({
						label: collection.name,
						target: {
							page: 'category',
							attributes: {
								category: 'collection',
								param: collection.id,
							},
						},
					}))
				}
			},
			{
				name: "标签",
				type: "dynamic",
				loader: () => {
					const tags = this.loadData('komga_tags')
					if (!Array.isArray(tags) || !tags.length) {
						return []
					}
					return tags.map((tag) => ({
						label: tag,
						target: {
							page: 'category',
							attributes: {
								category: 'tag',
								param: tag,
							},
						},
					}))
				}
			},
			{
				name: "语言",
				type: "dynamic",
				loader: () => {
					const languages = this.loadData('komga_languages')
					if (!Array.isArray(languages) || !languages.length) {
						return []
					}
					return languages.map((lang) => ({
						label: lang,
						target: {
							page: 'category',
							attributes: {
								category: 'language',
								param: lang,
							},
						},
					}))
				}
			},
			{
				name: "题材",
				type: "dynamic",
				loader: () => {
					const genres = this.loadData('komga_genres')
					if (!Array.isArray(genres) || !genres.length) {
						return []
					}
					return genres.map((genre) => ({
						label: genre,
						target: {
							page: 'category',
							attributes: {
								category: 'genre',
								param: genre,
							},
						},
					}))
				}
			}
		],
		enableRankingPage: false,
	}

	categoryComics = {
		load: async (category, param, options, page) => {
			await this.refreshReferenceData(false)
			const pageIndex = Math.max(0, (page || 1) - 1)
			const defaultSort = category === 'all' ? 'created,desc' : 'metadata.lastModified,desc'
			const sortValue = this.extractOption(options, 0, defaultSort)
			const query = {
				page: pageIndex,
				size: 30,
				sort: [sortValue]
			}
			if (category === 'all') {
				// const list = await this.fetchBookList('/api/v1/books', query)
				// return {
				// 	comics: list.comics,
				// 	maxPage: Math.max(1, list.totalPages)
				// }
				const list = await this.fetchSeriesList('/api/v1/series', query)
				return {
					comics: list.comics,
					maxPage: Math.max(1, list.totalPages)
				}
			}
			if (category === 'library' && param) {
				query.library_id = [param]
				const list = await this.fetchSeriesList('/api/v1/series', query)
				return {
					comics: list.comics,
					maxPage: Math.max(1, list.totalPages)
				}				
			}
			if (category === 'collection' && param) {
				const list = await this.fetchSeriesList(`/api/v1/collections/${param}/series`, query)
				return {
					comics: list.comics,
					maxPage: Math.max(1, list.totalPages)
				}
			}


			if (category === 'tag' && param) {
				query.tag = [param]
				const list = await this.fetchSeriesList('/api/v1/series', query)
				return {
					comics: list.comics,
					maxPage: Math.max(1, list.totalPages)
				}
			}


			if (category === 'language' && param){
				query.language = [param]
				const list = await this.fetchSeriesList('/api/v1/series', query)
				return {
					comics: list.comics,
					maxPage: Math.max(1, list.totalPages)
				}
			}

			// if (category === 'genre' && param) query.genre = [param]
			query.genre = [param]
			const list = await this.fetchSeriesList('/api/v1/series', query)

			return {
				comics: list.comics,
				maxPage: Math.max(1, list.totalPages)
			}
		},
		optionList: [
			{
				options: [
					'*created,desc-添加时间(新→旧)',
					'created,asc-添加时间(旧→新)',
					'metadata.lastModified,desc-更新时间(新→旧)',
					'metadata.lastModified,asc-更新时间(旧→新)',
					'metadata.titleSort,asc-标题(A-Z)',
					'metadata.titleSort,desc-标题(Z-A)'
				],
				notShowWhen: null,
				showWhen: null
			}
		]
	}

	search = {
		load: async (keyword, options, page) => {
			const pageIndex = Math.max(0, (page || 1) - 1)
			const sortValue = this.extractOption(options, 0, 'metadata.lastModified,desc')
			const query = {
				page: pageIndex,
				size: 30,
				sort: [sortValue]
			}
			let term = (keyword || '').trim()
			const colonIdx = term.indexOf(':')
			if (colonIdx > 0) {
				const prefix = term.slice(0, colonIdx).toLowerCase()
				const value = term.slice(colonIdx + 1).trim()
				if (value) {
					if (prefix === 'tag') query.tag = [value]
					else if (prefix === 'author') query.author = [`${value},`]
					else if (prefix === 'language') query.language = [value]
					else if (prefix === 'genre') query.genre = [value]
					else if (prefix === 'publisher') query.publisher = [value]
					else query.search = value
				}
				term = ''
			}
			if (term) query.search = term
			const list = await this.fetchSeriesList('/api/v1/series', query)
			return {
				comics: list.comics,
				maxPage: Math.max(1, list.totalPages)
			}
		},
		optionList: [
			{
				type: 'select',
				options: [
					'*metadata.lastModified,desc-更新时间(新→旧)',
					'metadata.lastModified,asc-更新时间(旧→新)',
					'metadata.titleSort,asc-标题(A-Z)',
					'metadata.titleSort,desc-标题(Z-A)'
				],
				label: '排序',
				default: null
			}
		]
	}

	comic = {
		loadInfo: async (id) => {
			const bookId = this.extractBookId(id)
			if (bookId) {
				return await this.loadBookDetails(bookId)
			}
			const [series, booksPage] = await Promise.all([
				this.getJson(`/api/v1/series/${id}`),
				this.getJson(`/api/v1/series/${id}/books`, {
					unpaged: true,
					sort: ['metadata.numberSort,asc']
				})
			])
			const books = Array.isArray(booksPage?.content) ? booksPage.content : []
			const readable = books.filter((book) => this.isSupportedBook(book))
			readable.sort((a, b) => this.compareBooks(a, b))
			const chapters = new Map()
			readable.forEach((book, index) => {
				chapters.set(book.id, this.formatBookTitle(book, index))
			})
			const metadata = series?.metadata || {}
			const summary = series?.booksMetadata?.summary || metadata.summary || ''
			const authors = this.collectAuthors(series?.booksMetadata?.authors)
			const genres = Array.isArray(metadata.genres) ? metadata.genres : []
			const tags = Array.isArray(series?.booksMetadata?.tags) ? series.booksMetadata.tags : []
			const description = summary || '暂无简介'
			const tagSections = {}
			if (authors.length) tagSections['作者'] = authors
			if (genres.length) tagSections['类型'] = this.uniqueArray(genres)
			if (tags.length) tagSections['标签'] = this.uniqueArray(tags)
			if (!readable.length && books.length) {
				tagSections['提示'] = ['该系列包含的项目暂不支持阅读']
			}
			const info = new ComicDetails({
				title: metadata.title || series?.name || id,
				subTitle: authors.slice(0, 3).join(', '),
				cover: this.buildUrl(`/api/v1/series/${id}/thumbnail`),
				description,
				tags: tagSections,
				chapters,
				updateTime: this.formatDate(series?.lastModified),
				uploadTime: this.formatDate(series?.created),
				url: series?.url || this.buildUrl(`/series/${id}`)
			})
			return info
		},
		loadEp: async (comicId, epId) => {
				let bookId = epId || comicId
				if (typeof bookId === 'string' && bookId.startsWith('book:')) {
					bookId = bookId.slice(5)
				}
				if (typeof comicId === 'string' && comicId.startsWith('book:') && !epId) {
					bookId = comicId.slice(5)
				}
			const pages = await this.getJson(`/api/v1/books/${bookId}/pages`)
			const list = Array.isArray(pages) ? pages : []
			list.sort((a, b) => (a?.number ?? 0) - (b?.number ?? 0))
			const zeroBased = list.some((page) => (page?.number ?? 1) === 0)
			const images = list
				.filter((page) => this.isPageRenderable(page))
				.map((page) => {
					const number = page?.number ?? 0
					return this.buildUrl(`/api/v1/books/${bookId}/pages/${number}`, zeroBased ? { zero_based: true } : null)
				})
			return { images }
		},
		onImageLoad: (url) => {
			return {
				headers: this.imageHeaders
			}
		},
		onThumbnailLoad: () => {
			return {
				headers: this.imageHeaders
			}
		},
		onClickTag: (namespace, tag) => {
			if (!tag) throw '无效的标签'
			const ns = (namespace || '').toLowerCase()
			if (ns === '作者') {
				return {
					action: 'search',
					keyword: `author:${tag}`,
					param: null,
				}
			}
			if (ns === '类型' || ns === '标签') {
				return {
					action: 'category',
					keyword: `genre:${tag}`,
					param: `${tag}`,
				}
			}
			return {
				action: 'search',
				keyword: tag,
				param: null,
			}
		},
		enableTagsTranslate: false,
	}

	async refreshReferenceData(force) {
		const token = this.authToken
		if (!token) {
			this.saveData('komga_libraries', [])
			this.saveData('komga_tags', [])
			this.saveData('komga_genres', [])
			this.saveData('komga_languages', [])
			this.saveData('komga_collections', [])
			return
		}
		const now = Date.now()
		const last = this.loadData('komga_meta_ts')
		if (!force && last && now - last < 5 * 60 * 1000) return
		try {
			const [libraries, tags, languages, collections, genres] = await Promise.all([
				this.getJson('/api/v1/libraries'),
				this.getJson('/api/v1/tags/series'),
				this.getJson('/api/v1/languages'),
				this.getJson('/api/v1/collections', { unpaged: true, sort: ['name,asc'] }),
				this.getJson('/api/v1/genres')
			])
			const libraryList = Array.isArray(libraries) ? libraries.filter((library) => library && library.id) : []
			const collectionPage = collections && typeof collections === 'object' ? collections : null
			const collectionList = Array.isArray(collectionPage?.content) ? collectionPage.content : Array.isArray(collections) ? collections : []
			this.saveData('komga_libraries', libraryList)
			this.saveData('komga_tags', Array.isArray(tags) ? tags : [])
			this.saveData('komga_genres', Array.isArray(genres) ? genres : [])
			this.saveData('komga_languages', Array.isArray(languages) ? languages : [])
			this.saveData('komga_collections', collectionList)
			this.saveData('komga_meta_ts', now)
		} catch (error) {
			this.saveData('komga_libraries', [])
			this.saveData('komga_tags', [])
			this.saveData('komga_genres', [])
			this.saveData('komga_languages', [])
			this.saveData('komga_collections', [])
			if (String(error) === 'Login expired') throw error
		}
	}

	async fetchSeriesList(path, query) {
		const data = await this.getJson(path, query)
		const content = Array.isArray(data?.content) ? data.content : []
		const comics = content.map((item) => this.parseSeries(item)).filter(Boolean)
		return {
			comics,
			totalPages: data?.totalPages ?? 1
		}
	}

	async fetchBookList(path, query) {
		const data = await this.getJson(path, query)
		const content = Array.isArray(data?.content) ? data.content : []
		const comics = content.map((item) => this.parseBook(item)).filter(Boolean)
		return {
			comics,
			totalPages: data?.totalPages ?? 1
		}
	}

	parseBook(book) {
		if (!book || !this.isSupportedBook(book)) return null
		const metadata = book.metadata || {}
		const title = metadata.title || book.name || book.id
		const authors = this.collectAuthors(metadata.authors)
		const tags = Array.isArray(metadata.tags) ? metadata.tags : []
		const description = metadata.summary || ''
		const subtitleParts = []
		if (book.seriesTitle) subtitleParts.push(book.seriesTitle)
		if (authors.length) subtitleParts.push(authors[0])
		return new Comic({
			id: `book:${book.id}`,
			title,
			subTitle: subtitleParts.join(' · '),
			cover: this.buildUrl(`/api/v1/books/${book.id}/thumbnail`),
			tags: this.uniqueArray(tags).slice(0, 12),
			description,
		})
	}

	extractBookId(id) {
		if (typeof id !== 'string') return null
		return id.startsWith('book:') ? id.slice(5) : null
	}

	async loadBookDetails(bookId) {
		const book = await this.getJson(`/api/v1/books/${bookId}`)
		if (!book) throw '未找到该图书'
		const metadata = book.metadata || {}
		const authors = this.collectAuthors(metadata.authors)
		const tags = this.uniqueArray(Array.isArray(metadata.tags) ? metadata.tags : [])
		const description = metadata.summary || '暂无简介'
		const tagSections = {}
		if (authors.length) tagSections['作者'] = authors
		if (tags.length) tagSections['标签'] = tags
		if (book.seriesTitle) tagSections['系列'] = [book.seriesTitle]
		if (!this.isSupportedBook(book)) tagSections['提示'] = ['该图书暂不支持阅读']
		const chapters = new Map()
		const chapterTitle = metadata.title || book.name || '立即阅读'
		chapters.set(book.id, chapterTitle)
		return new ComicDetails({
			title: metadata.title || book.name || bookId,
			subTitle: book.seriesTitle || authors.slice(0, 3).join(', '),
			cover: this.buildUrl(`/api/v1/books/${bookId}/thumbnail`),
			description,
			tags: tagSections,
			chapters,
			updateTime: this.formatDate(book.lastModified),
			uploadTime: this.formatDate(book.created),
			url: book.url || this.buildUrl(`/books/${bookId}`)
		})
	}

	parseSeries(series) {
		if (!series) return null
		const metadata = series.metadata || {}
		const title = metadata.title || series.name || series.id
		const authors = this.collectAuthors(series?.booksMetadata?.authors)
		const tags = []
		if (Array.isArray(metadata.genres)) tags.push(...metadata.genres)
		if (Array.isArray(series?.booksMetadata?.tags)) tags.push(...series.booksMetadata.tags)
		const description = series?.booksMetadata?.summary || metadata.summary || ''
		return new Comic({
			id: series.id,
			title,
			subTitle: authors.slice(0, 2).join(', '),
			cover: this.buildUrl(`/api/v1/series/${series.id}/thumbnail`),
			tags: this.uniqueArray(tags).slice(0, 12),
			description,
		})
	}

	collectAuthors(authors) {
		if (!Array.isArray(authors)) return []
		return this.uniqueArray(authors.map((author) => author?.name).filter(Boolean))
	}

	uniqueArray(list) {
		if (!Array.isArray(list)) return []
		const set = new Set()
		const result = []
		for (const item of list) {
			const value = typeof item === 'string' ? item.trim() : ''
			if (!value) continue
			const key = value.toLowerCase()
			if (set.has(key)) continue
			set.add(key)
			result.push(value)
		}
		return result
	}

	isSupportedBook(book) {
		if (!book || !book.media) return false
		const status = String(book.media.status || '').toUpperCase()
		if (status && status !== 'READY') return false
		const mediaType = String(book.media.mediaType || '').toLowerCase()
		if (!mediaType) return false
		if (mediaType.includes('epub') || mediaType.includes('pdf') || mediaType.includes('mobi')) return false
		if ((book.media.pagesCount || 0) <= 0) return false
		return true
	}

	isPageRenderable(page) {
		if (!page) return false
		const mediaType = String(page.mediaType || '').toLowerCase()
		if (!mediaType) return true
		return mediaType.startsWith('image/') || mediaType.includes('jpeg') || mediaType.includes('png') || mediaType.includes('webp')
	}

	compareBooks(a, b) {
		const aSort = typeof a?.metadata?.numberSort === 'number' ? a.metadata.numberSort : NaN
		const bSort = typeof b?.metadata?.numberSort === 'number' ? b.metadata.numberSort : NaN
		if (!Number.isNaN(aSort) && !Number.isNaN(bSort)) return aSort - bSort
		const aNumber = parseFloat(a?.metadata?.number)
		const bNumber = parseFloat(b?.metadata?.number)
		if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) return aNumber - bNumber
		return (a?.metadata?.title || a?.name || '').localeCompare(b?.metadata?.title || b?.name || '')
	}

	formatBookTitle(book, index) {
		const metadata = book?.metadata || {}
		if (metadata.title) return metadata.title
		if (metadata.number) return `第${metadata.number}卷`
		if (book?.number != null) return `第${book.number}卷`
		return `章节 ${index + 1}`
	}

	extractOption(options, index, fallback) {
		if (!Array.isArray(options) || options.length <= index) return fallback
		let value = options[index]
		if (typeof value !== 'string') return fallback
		if (value.startsWith('*')) value = value.slice(1)
		const idx = value.indexOf('-')
		return idx > -1 ? value.slice(0, idx) : value
	}

	async getJson(path, query) {
		const res = await Network.get(this.buildUrl(path, query), this.headers)
		this.ensureOk(res)
		const text = res.body
		if (!text) return null
		return JSON.parse(text)
	}

	ensureOk(res) {
		if (!res) throw '请求失败'
		if (res.status === 401 || res.status === 403) throw 'Login expired'
		if (res.status < 200 || res.status >= 300) throw `请求失败: ${res.status}`
	}

	buildUrl(path, query) {
		let url = path
		if (!/^https?:\/\//i.test(path)) {
			url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
		}
		const qs = this.buildQuery(query)
		return qs ? `${url}?${qs}` : url
	}

	buildQuery(query) {
		if (!query) return ''
		const parts = []
		for (const key of Object.keys(query)) {
			const value = query[key]
			if (value === undefined || value === null) continue
			if (Array.isArray(value)) {
				for (const item of value) {
					if (item === undefined || item === null) continue
					parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
				}
			} else {
				parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
			}
		}
		return parts.join('&')
	}

	formatDate(value) {
		if (!value) return null
		try {
			const date = new Date(value)
			if (Number.isNaN(date.getTime())) return null
			return date.toISOString().split('T')[0]
		} catch (_) {
			return null
		}
	}
}

