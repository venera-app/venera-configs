#!/usr/bin/env python3
import argparse
import json
import random
import time
import re
import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

class ComicSourceTester:
    def __init__(self, url, name, key, version, need_login=False, backup_domains=None):
        self.url = self.normalize_url(url)
        self.name = name
        self.key = key
        self.version = version
        self.need_login = need_login
        self.backup_domains = backup_domains or []
        self.ua = UserAgent()
        self.session = requests.Session()
        self.results = {}
        self.cache = {}
        
    def normalize_url(self, url):
        if not url.startswith('http'):
            url = 'https://' + url
        if url.endswith('/'):
            url = url[:-1]
        return url
        
    def get_random_headers(self):
        return {
            'User-Agent': self.ua.random,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
    def delay(self, min_delay=1, max_delay=3):
        time.sleep(random.uniform(min_delay, max_delay))
        
    def request_with_retry(self, url, method='get', max_retries=3, **kwargs):
        headers = kwargs.pop('headers', {})
        headers.update(self.get_random_headers())
        
        for attempt in range(max_retries):
            try:
                self.delay()
                if method.lower() == 'get':
                    response = self.session.get(url, headers=headers, timeout=30, **kwargs)
                else:
                    response = self.session.post(url, headers=headers, timeout=30, **kwargs)
                
                if response.status_code == 200:
                    return response
                elif response.status_code in [403, 429]:
                    self.log('WARNING', f'请求被限制，尝试第 {attempt+1} 次')
                    self.delay(3, 5)
                else:
                    self.log('WARNING', f'状态码: {response.status_code}')
                    
            except Exception as e:
                self.log('WARNING', f'请求失败: {str(e)}')
                
            if attempt < max_retries - 1:
                if self.backup_domains:
                    domain = self.backup_domains[attempt % len(self.backup_domains)]
                    url = re.sub(r'https?://[^/]+', f'https://{domain}', url)
                    self.log('INFO', f'切换到备用域名: {domain}')
        
        self.log('ERROR', f'请求失败，已重试 {max_retries} 次')
        return None
        
    def log(self, level, message):
        print(f'[{level}] {message}')
        
    def test_explore(self):
        self.log('INFO', '开始测试发现页...')
        response = self.request_with_retry(self.url)
        if not response:
            self.log('WARNING', '发现页测试失败，跳过')
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        sections = []
        
        comic_selectors = [
            'div.comic-item', 'div.manga-item', 'div.book-item',
            'article.comic', 'li.comic-item', 'div.item',
            '.comic-list > div', '.manga-list > div', '.list-item'
        ]
        
        found_comics = []
        for selector in comic_selectors:
            items = soup.select(selector)
            if len(items) >= 3:
                found_comics = items
                break
                
        if not found_comics:
            items = soup.find_all(['div', 'article', 'li'], class_=lambda c: c and any(k in c.lower() for k in ['comic', 'manga', 'book', 'item']))
            if len(items) >= 3:
                found_comics = items[:20]
        
        if found_comics:
            first_item = found_comics[0]
            title_selector = self.find_title_selector(first_item)
            cover_selector = self.find_cover_selector(first_item)
            
            sections.append({
                'title': '推荐',
                'type': 'multiPartPage',
                'url': self.url,
                'selector': selector if 'selector' in dir() else 'div',
                'idAttr': 'data-id' if first_item.get('data-id') else 'href',
                'titleSelector': title_selector or 'h3',
                'coverSelector': cover_selector or 'img',
                'coverAttr': 'src',
                'key': 'recommend'
            })
            
            self.log('SUCCESS', f'发现页测试通过，解析到 {len(found_comics)} 个漫画')
            return {'sections': sections}
        else:
            self.log('WARNING', '未找到漫画列表结构')
            return None
            
    def find_title_selector(self, element):
        selectors = ['h3', 'h4', 'a.title', '.title', 'span.title', 'h2', 'a']
        for selector in selectors:
            if element.select_one(selector):
                return selector
        return None
        
    def find_cover_selector(self, element):
        selectors = ['img', 'div.cover img', '.cover-img', 'a img']
        for selector in selectors:
            if element.select_one(selector):
                return selector
        return None
        
    def test_search(self):
        self.log('INFO', '开始测试搜索功能...')
        
        search_form = None
        search_input = None
        search_url = None
        
        response = self.request_with_retry(self.url)
        if not response:
            self.log('WARNING', '搜索测试失败，跳过')
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        forms = soup.find_all('form')
        for form in forms:
            inputs = form.find_all('input', type='text')
            if inputs and any('search' in inp.get('name', '').lower() or 'keyword' in inp.get('name', '').lower() for inp in inputs):
                search_form = form
                search_input = inputs[0]
                break
                
        if search_form:
            action = search_form.get('action', self.url)
            if not action.startswith('http'):
                action = self.url + ('/' if not self.url.endswith('/') else '') + action
            search_url = action
            input_name = search_input.get('name', 'keyword')
            
            test_url = f"{search_url}?{input_name}=test"
            test_response = self.request_with_retry(test_url)
            
            if test_response:
                test_soup = BeautifulSoup(test_response.text, 'html.parser')
                results = test_soup.find_all(['div', 'article', 'li'], class_=lambda c: c and any(k in c.lower() for k in ['result', 'item', 'comic', 'manga']))
                
                if results:
                    first_result = results[0]
                    self.log('SUCCESS', f'搜索测试通过，找到 {len(results)} 个结果')
                    return {
                        'url': test_url.replace('test', '{{keyword}}'),
                        'selector': 'div',
                        'idAttr': 'data-id' if first_result.get('data-id') else 'href',
                        'titleSelector': self.find_title_selector(first_result) or 'h3',
                        'coverSelector': self.find_cover_selector(first_result) or 'img',
                        'coverAttr': 'src'
                    }
        
        self.log('WARNING', '未找到搜索功能')
        return None
        
    def test_category(self):
        self.log('INFO', '开始测试分类功能...')
        
        response = self.request_with_retry(self.url)
        if not response:
            self.log('WARNING', '分类测试失败，跳过')
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        category_selectors = [
            'nav.category', 'div.categories', 'ul.category-list',
            '.category-nav', 'div.tags', 'ul.tags'
        ]
        
        for selector in category_selectors:
            category_section = soup.select_one(selector)
            if category_section:
                category_links = category_section.find_all('a')
                if len(category_links) >= 3:
                    categories = []
                    for link in category_links[:10]:
                        name = link.get_text(strip=True)
                        href = link.get('href')
                        if name and href:
                            if not href.startswith('http'):
                                href = self.url + ('/' if not self.url.endswith('/') else '') + href
                            categories.append({
                                'label': name,
                                'value': href.split('=')[-1] if '=' in href else name
                            })
                    
                    if categories:
                        self.log('SUCCESS', f'分类测试通过，找到 {len(categories)} 个分类')
                        return {
                            'categories': [{'name': '分类', 'items': categories}]
                        }
        
        self.log('WARNING', '未找到分类结构')
        return None
        
    def test_comic_info(self):
        self.log('INFO', '开始测试漫画详情...')
        
        explore_result = self.results.get('explore')
        if not explore_result:
            self.log('WARNING', '需要先测试发现页')
            return None
            
        first_section = explore_result['sections'][0]
        response = self.request_with_retry(self.url)
        if not response:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        comic_items = soup.select(first_section.get('selector', 'div'))
        
        if not comic_items:
            self.log('WARNING', '未找到漫画项')
            return None
            
        first_item = comic_items[0]
        comic_link = first_item.find('a')
        
        if not comic_link or not comic_link.get('href'):
            self.log('WARNING', '未找到漫画链接')
            return None
            
        comic_href = comic_link.get('href')
        if not comic_href.startswith('http'):
            comic_href = self.url + ('/' if not self.url.endswith('/') else '') + comic_href
            
        comic_response = self.request_with_retry(comic_href)
        if not comic_response:
            return None
            
        comic_soup = BeautifulSoup(comic_response.text, 'html.parser')
        
        title_selector = self.find_title_selector(comic_soup) or 'h1'
        cover_selector = self.find_cover_selector(comic_soup) or 'img.cover'
        
        title = comic_soup.select_one(title_selector)
        cover = comic_soup.select_one(cover_selector)
        
        chapter_selectors = [
            'ul.chapters li', 'div.chapters a', '.chapter-list a',
            'ul.list li a', 'div.episode a'
        ]
        
        chapters = []
        for selector in chapter_selectors:
            chapter_items = comic_soup.select(selector)
            if chapter_items:
                for item in chapter_items[:20]:
                    chapter_title = item.get_text(strip=True)
                    chapter_href = item.get('href')
                    if chapter_title and chapter_href:
                        chapters.append({
                            'title': chapter_title,
                            'href': chapter_href
                        })
                break
                
        if title or chapters:
            self.log('SUCCESS', f'漫画详情测试通过，标题: {title.get_text(strip=True) if title else "未知"}，章节数: {len(chapters)}')
            return {
                'infoUrl': comic_href,
                'titleSelector': title_selector,
                'coverSelector': cover_selector,
                'coverAttr': 'src',
                'authorSelector': '.author',
                'descSelector': '.description',
                'chapterSelector': selector if 'selector' in dir() else 'a',
                'chapterIdAttr': 'href',
                'chapterTitleSelector': '',
                'firstChapterHref': chapters[0]['href'] if chapters else ''
            }
        
        self.log('WARNING', '未找到漫画详情结构')
        return None
        
    def test_comic_images(self):
        self.log('INFO', '开始测试漫画图片...')
        
        comic_info = self.results.get('comic')
        if not comic_info or not comic_info.get('firstChapterHref'):
            self.log('WARNING', '需要先测试漫画详情')
            return None
            
        chapter_href = comic_info['firstChapterHref']
        if not chapter_href.startswith('http'):
            chapter_href = self.url + ('/' if not self.url.endswith('/') else '') + chapter_href
            
        chapter_response = self.request_with_retry(chapter_href)
        if not chapter_response:
            return None
            
        chapter_soup = BeautifulSoup(chapter_response.text, 'html.parser')
        
        image_selectors = [
            'div.images img', 'div.content img', '.comic-image img',
            'img.lazy', 'img[data-src]', 'article img'
        ]
        
        images = []
        found_selector = None
        for selector in image_selectors:
            img_tags = chapter_soup.select(selector)
            if len(img_tags) >= 3:
                images = img_tags
                found_selector = selector
                break
                
        if not images:
            img_tags = chapter_soup.find_all('img')
            if len(img_tags) >= 3:
                images = img_tags
                found_selector = 'img'
        
        if images:
            src_attr = 'data-src' if images[0].get('data-src') else 'src'
            self.log('SUCCESS', f'漫画图片测试通过，找到 {len(images)} 张图片')
            return {
                'epUrl': chapter_href,
                'imageSelector': found_selector or 'img',
                'imageAttr': src_attr
            }
        
        self.log('WARNING', '未找到图片结构')
        return None
        
    def run_all_tests(self):
        self.log('INFO', '='*50)
        self.log('INFO', f'开始测试漫画源: {self.name}')
        self.log('INFO', '='*50)
        
        self.results['explore'] = self.test_explore()
        self.results['search'] = self.test_search()
        self.results['category'] = self.test_category()
        self.results['comic'] = self.test_comic_info()
        self.results['images'] = self.test_comic_images()
        
        self.log('INFO', '='*50)
        self.log('INFO', '测试完成')
        self.log('INFO', '='*50)
        
        return self.results
        
def main():
    parser = argparse.ArgumentParser(description='测试漫画网站并生成源配置')
    parser.add_argument('--url', required=True, help='漫画网站URL')
    parser.add_argument('--name', required=True, help='网站名称')
    parser.add_argument('--key', required=True, help='源Key')
    parser.add_argument('--version', default='1.0.0', help='版本号')
    parser.add_argument('--need-login', default='false', help='是否需要登录')
    parser.add_argument('--backup-domains', default='', help='备用域名，逗号分隔')
    
    args = parser.parse_args()
    
    backup_domains = [d.strip() for d in args.backup_domains.split(',')] if args.backup_domains else []
    
    tester = ComicSourceTester(
        url=args.url,
        name=args.name,
        key=args.key,
        version=args.version,
        need_login=args.need_login.lower() == 'true',
        backup_domains=backup_domains
    )
    
    results = tester.run_all_tests()
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()