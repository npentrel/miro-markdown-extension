// Convert widgets that contain markdown to formatted widgets.

async function convertMarkdownWidgets(widgets) {
    if (!widgets) {
        return;
    }

    let count = 0;
    for (let i = 0; i < widgets.length; i++) {
        let widget = widgets[i];

        let markdown_text = getMarkdownText(widget);
        let html_text = marked(markdown_text);
        let new_widgets = htmlToWidgets(html_text);

        try {
            await addNewWidgets(new_widgets, widget.bounds.left, widget.bounds.top, widget.width);
            miro.board.widgets.deleteById({ id: widget.id })
            count++;
        } catch (e) {
            console.error(e);
            miro.showErrorNotification("An unknown error occured within the app.");
        }
    }
    miro.showNotification(`Converted ${count} widgets from Markdown`);
}

const BLOCK_ELEMENTS = {
    'p': 1,
    'div': 1,
    'h1': 1,
    'h2': 1,
    'h3': 1,
    'h4': 1,
    'h5': 1,
    'h6': 1,
    'ul': 1,
    'ol': 1,
    'li': 1,
    'code': 1,
    'br': 1
};

// Parse the text of a widget to get the markdown from a widget.
// Code is adapted from https://github.com/GreenAsh/code-highlighter/blob/master/miro-plugin.js

function getMarkdownText(widget) {
    if (!widget || !widget.text) {
        return;
    }

    let div = document.createElement('div');
    div.innerHTML = widget.text;
    return computePlainText(div);


    function computePlainText(parentElement) {
        let text = '';
        const children = parentElement.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            }
            // when a user copies markdown into miro the lists are
            // automatically changed
            if (child.nodeName === "LI") {
                if (child.getAttribute("data-list") && child.getAttribute("data-list") === "ordered") {
                    text += "1. ";
                } else {
                    text += "- ";
                }
            }

            let childText = '';
            if (child.hasChildNodes()) {
                childText = computePlainText(child);
            }

            if (isBlockElement(child)) {
                if (childText !== '\n') {
                    text += childText;
                }
                text += '\n';
            } else {
                text += childText;
            }
        }
        return text;
    }

    function isBlockElement(element) {
        return element.tagName && BLOCK_ELEMENTS[element.tagName.toLowerCase()] === 1;
    }

}

// Header elements and the designates scales (font sizes)
const HEADERS = {
    'H1': 1.7142857142857142,
    'H2': 1.7142857142857142,
    'H3': 1.28571428571429,
    'H4': 1.28571428571429,
    'H5': 1,
    'H6': 1,
};

// Divide content into multiple widgets.

function htmlToWidgets(text) {
    let parentElement = document.createElement('div');
    parentElement.innerHTML = text;

    let widgets = []

    const children = parentElement.childNodes;

    // To keep paragraph elements that follow one another in one widget we
    // keep track of the text in the elements and append the text in one
    // when we encounter the end of the html or an element that is not
    // paragraph text.
    let paragraph_text = "";

    for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (HEADERS[child.nodeName] !== undefined) { // it's a header
            // add paragraph widget if there is paragraph text
            if (paragraph_text !== "") {
                widgets.push({
                    "type": "TEXT",
                    "text": paragraph_text
                });
                paragraph_text = "";
            }

            let header_content = parseContent(child);
            let fontSize = HEADERS[child.nodeName];

            let header_text = "";
            for (let i = 0; i < header_content.length; i++) {
                if (header_content[i]["type"] === "IMAGE") { // image
                    // add header widget if there is header text
                    if (header_text !== "") {
                        // H1, H3, and H5 are bold
                        if (parseInt(child.nodeName[1]) % 2) {
                            header_text = "<strong>" + header_text + "</strong>";
                        }
                        widgets.push({
                            "type": "TEXT",
                            "text": header_text,
                            "scale": fontSize
                        });
                        header_text = "";
                    }

                    // add image widget
                    widgets.push(header_content[i]);
                } else { // inline code or text
                    header_text = header_text + header_content[i]["text"];
                }
            }

            // H1, H3, and H5 are bold
            if (parseInt(child.nodeName[1]) % 2) {
                header_text = "<strong>" + header_text + "</strong>";
            }

            widgets.push({
                "type": "TEXT",
                "text": header_text,
                "scale": fontSize
            })
        } else if ("HR" === child.nodeName) { // it's a horizontal line
            if (paragraph_text !== "") {
                paragraph_text = paragraph_text + "------------------------";
            }
        } else if ("BLOCKQUOTE" === child.nodeName) { // it's a block quote
            // add paragraph widget if there is paragraph text
            if (paragraph_text !== "") {
                widgets.push({
                    "type": "TEXT",
                    "text": paragraph_text
                });
                paragraph_text = "";
            }

            widgets.push({
                "type": "TEXT",
                "text": "<em>" + child.innerHTML + "</em>",
                "style": { backgroundColor: "#12cdd4" }
            })
        } else {
            if (child.outerHTML !== undefined) { // there is HTML content
                paragraph_content = parseContent(child);

                let in_list = 0;
                if (child.nodeName === "OL" || child.nodeName === "UL") {
                    // preserve list tags
                    paragraph_text = paragraph_text + "<" + child.nodeName + ">";
                    in_list = in_list + 1;
                }

                for (let i = 0; i < paragraph_content.length; i++) {
                    if (paragraph_content[i]["type"] === "IMAGE") { // image
                        // add paragraph widget if there is paragraph text
                        if (paragraph_text !== "") {
                            widgets.push({
                                "type": "TEXT",
                                "text": paragraph_text
                            });
                            paragraph_text = "";
                        }

                        // add image widget
                        widgets.push(paragraph_content[i]);
                    } else { // code or text
                        if (paragraph_content[i]["type"] === "CODE" && in_list === 0) {
                            // code that is not inside a list (code in a
                            // list will be treated as inline code)

                            // add paragraph widget if there is paragraph text
                            if (paragraph_text !== "") {
                                widgets.push({
                                    "type": "TEXT",
                                    "text": paragraph_text
                                });
                                paragraph_text = "";
                            }

                            widgets.push({
                                "type": "TEXT",
                                "text": paragraph_content[i]["text"],
                                "style": {
                                    backgroundColor: "#e6e6e6",
                                    fontFamily: 17
                                },
                                "scale": 0.8571428571428571
                            });

                        } else { // regular text or inline code
                            paragraph_text = paragraph_text + paragraph_content[i]["text"];
                        }
                    }
                }
                if (child.nodeName === "OL" || child.nodeName === "UL") {
                    // preserve list tags
                    paragraph_text = paragraph_text + "</" + child.nodeName + ">"
                    in_list = in_list - 1;
                }
            } else { // it's a break between elements
                if (paragraph_text !== "") {
                    paragraph_text = paragraph_text + "<br><br>";
                }
            }
        }
    }

    // add paragraph widget if there is paragraph text
    if (paragraph_text !== "") {
        widgets.push({
            "type": "TEXT",
            "text": paragraph_text
        });
    }

    return widgets;
}

// Paragraph elements can contain code blocks, inline code,
// and images. This function parses these. Note that for simplicity
// purposes, code blocks inside lists are not supported.

function parseContent(paragraph) {
    let content = [];
    const children = paragraph.childNodes;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tag = child.nodeName;

        if ("IMG" === tag) { // found an image
            content.push({
                "type": "IMAGE",
                "url": child.src
            });
        } else if ("PRE" === tag || "CODE" === tag) { // found code
            let language = getCodeBlockLanguage(child);
            let highlightedCode = highlightCode(child.textContent, document, language);

            // add code background color
            highlightedCode = "<span style=\"background-color: rgb(230, 230, 230); color: rgb(26, 26, 26);\">" + highlightedCode + "</span>";

            if (isCodeBlock(child)) {
                content.push({
                    "type": "CODE",
                    "text": highlightedCode
                });
            } else { // it's inline code
                content.push({
                    "type": "INLINE-CODE",
                    "text": highlightedCode
                });
            }
        } else { // found something else, treat as text
            if (child.outerHTML) { // text styles or other html elements
                content.push({
                    "type": "TEXT",
                    "text": child.outerHTML
                });
            } else { // only text
                content.push({
                    "type": "TEXT",
                    "text": child.textContent
                });
            }
        }
    }
    return content;

    // codeblocks have a parent node: <pre><code> ... </code></pre>
    function isCodeBlock(node) {
        return node.parentNode.nodeName === "PRE";
    }

    // if the markdown code block had a language specified it gets added
    // as a class: <code class="language-javascript"> ... <code>
    function getCodeBlockLanguage(node) {
        if (node.getAttribute("class") !== null) {
            return node.getAttribute("class").slice(9);
        } else {
            return "bash";
        }
    }
}

// adds new widgets recursively

async function addNewWidgets(newWidgets, positionLeft, positionTop, width) {
    if (!newWidgets.length) {
        return
    }

    // set the initial position
    newWidgets[0]["x"] = positionLeft;
    newWidgets[0]["y"] = positionTop;

    // adjust the width by the scale factor to account for font sizes
    if (newWidgets[0]["scale"]) {
        newWidgets[0]["width"] = width / newWidgets[0]["scale"];
    } else {
        newWidgets[0]["width"] = width;
    }

    // create the new widget
    widget = await miro.board.widgets.create(newWidgets[0]);

    // Adjust the positioning of the widget based on the widgets height
    // and width. The widgets get added slightly to the left and to the
    // top and we do not know the widgets height until it is added. Note
    // that while we know the width for text elements, images do not
    // adhere to the width you provide.
    newWidgets[0]["x"] = positionLeft + widget[0].bounds.width / 2;
    newWidgets[0]["y"] = positionTop + widget[0].bounds.height / 2;


    // Set the widget id and update the widget position
    newWidgets[0]["id"] = widget[0]["id"];
    widget = await miro.board.widgets.update(newWidgets[0]);

    newWidgets.shift();
    addNewWidgets(newWidgets, positionLeft, widget[0].bounds.bottom + 10, width);
}