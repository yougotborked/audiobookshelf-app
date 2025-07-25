<template>
  <div class="mobi-ebook-viewer w-full relative">
    <div class="absolute overflow-hidden left-0 top-0 w-screen max-w-screen m-auto z-10 border border-black border-opacity-20 shadow-md bg-white">
      <iframe title="html-viewer" class="w-full overflow-hidden"> Loading </iframe>
    </div>
  </div>
</template>

<script>
import MobiParser from '@/assets/ebooks/mobi.js'
import HtmlParser from '@/assets/ebooks/htmlParser.js'
import defaultCss from '@/assets/ebooks/basic.js'

export default {
  props: {
    url: String,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {
    addHtmlCss() {
      let iframe = document.getElementsByTagName('iframe')[0]
      if (!iframe) return
      let doc = iframe.contentDocument
      if (!doc) return
      let style = doc.createElement('style')
      style.id = 'default-style'
      style.textContent = defaultCss
      doc.head.appendChild(style)
    },
    handleIFrameHeight(iFrame) {
      const isElement = (obj) => !!(obj && obj.nodeType === 1)

      var body = iFrame.contentWindow.document.body,
        html = iFrame.contentWindow.document.documentElement
      iFrame.height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight) * 2

      setTimeout(() => {
        let lastchild = body.lastElementChild
        let lastEle = body.lastChild

        let itemAs = body.querySelectorAll('a')
        let itemPs = body.querySelectorAll('p')
        let lastItemA = itemAs[itemAs.length - 1]
        let lastItemP = itemPs[itemPs.length - 1]
        let lastItem
        if (isElement(lastItemA) && isElement(lastItemP)) {
          if (lastItemA.clientHeight + lastItemA.offsetTop > lastItemP.clientHeight + lastItemP.offsetTop) {
            lastItem = lastItemA
          } else {
            lastItem = lastItemP
          }
        }

        if (!lastchild && !lastItem && !lastEle) return
        if (lastEle.nodeType === 3 && !lastchild && !lastItem) return

        let nodeHeight = 0
        if (lastEle.nodeType === 3 && document.createRange) {
          let range = document.createRange()
          range.selectNodeContents(lastEle)
          if (range.getBoundingClientRect) {
            let rect = range.getBoundingClientRect()
            if (rect) {
              nodeHeight = rect.bottom - rect.top
            }
          }
        }
        var lastChildHeight = isElement(lastchild) ? lastchild.clientHeight + lastchild.offsetTop : 0
        var lastEleHeight = isElement(lastEle) ? lastEle.clientHeight + lastEle.offsetTop : 0
        var lastItemHeight = isElement(lastItem) ? lastItem.clientHeight + lastItem.offsetTop : 0
        iFrame.height = Math.max(lastChildHeight, lastEleHeight, lastItemHeight) + 100 + nodeHeight
      }, 500)
    },
    async initMobi() {
      // Fetch mobi file as blob
      // TODO: Handle JWT auth refresh
      var buff = await this.$axios.$get(this.url, {
        responseType: 'blob'
      })
      var reader = new FileReader()
      reader.onload = async (event) => {
        var file_content = event.target.result

        let mobiFile = new MobiParser(file_content)

        let content = await mobiFile.render()
        let htmlParser = new HtmlParser(new DOMParser().parseFromString(content.outerHTML, 'text/html'))
        var anchoredDoc = htmlParser.getAnchoredDoc()

        let iFrame = document.getElementsByTagName('iframe')[0]
        iFrame.contentDocument.body.innerHTML = anchoredDoc.documentElement.outerHTML

        // Add css
        let style = iFrame.contentDocument.createElement('style')
        style.id = 'default-style'
        style.textContent = defaultCss
        iFrame.contentDocument.head.appendChild(style)

        this.handleIFrameHeight(iFrame)
      }
      reader.readAsArrayBuffer(buff)
    }
  },
  mounted() {
    this.initMobi()
  }
}
</script>

<style>
.mobi-ebook-viewer {
  height: calc(100% - 32px);
  max-height: calc(100% - 32px);
  overflow-x: hidden;
  overflow-y: auto;
}
.reader-player-open .mobi-ebook-viewer {
  height: calc(100% - 132px);
  max-height: calc(100% - 132px);
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
