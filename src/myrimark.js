const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const { window } = dom;
const document = window.document;

class MyriMark {
    static ParsePageMyriMarkDivs() {
        const divs = document.querySelectorAll("div.myrimark-container");
        for (const div of divs) {
            const body = this.ParseMyriMark(div.innerHTML);
            div.innerHTML = '';
            if (body) div.append(body);
        }
    }

    /**
     * 
     * @param {string[]} array 
     */
    static Condense(array) {
        let return_array = [];
        let string = "";
        for (const ele of array) {
            if (typeof ele === 'string')
                string += ele+'\n'
            else {
                return_array.push(string);
                return_array.push(this.Condense(ele))
                string = "";
            }
        }
        return_array.push(string);
        return return_array;
    }

    /**
     * 
     * @param {string} body 
     */
    static BreakUp(body) {
        const lines = body.split(/\n/);
        const begin_regex = /\$begin(.*)$/;
        const end_regex = /\$end$/;
        let end_index = 0;
        let inside = false;
        let working = [];
        for (const line of lines) {
            if (begin_regex.test(line)) {
                end_index++;
                if (!inside) {
                    inside = true;
                    working.push([line.replace(/^\$/, ':')]);
                } else {
                    working[working.length-1].push(line);
                }
            } else if (end_regex.test(line)) {
                end_index--;
                if (end_index===0) {
                    inside = false;
                    working[working.length-1] = this.BreakUp(
                        (working[working.length-1].concat(['$end'])).join('\n'));
                } else {
                    if (inside) working[working.length-1].push(line);
                    else working.push(line);
                }
            } else if (inside) {
                working[working.length-1].push(line);
            } else {
                working.push(line);
            }
        }
        return working;
    }

    static Regexes = {
        'excess': {
            'begining_whitespace': /^[\t ]*/gm,
            'ending_whitespace':   /[\t ]*$/gm,
            'begining_lines': /^\n*/g,
            'ending_lines': /\n*$/g
        },
        'seperators': {
            'paragraphs': /\n{2,}/gm
        },
        'list': {
            'li_content': /[*-] *(.*$)/gm,
            'checkbox_content': /> *(.*$)/gm
        },
        'line': {
            'bold': /(?<!\\)\*\*(.*?)(?<!\\)\*\*/gm,
            'italic': /(?<!\\)\/\/(.*?)(?<!\\)\/\//gm,
            'strikethrough': /(?<!\\)~~(.*?)(?<!\\)~~/gm,
            'underline': /(?<!\\)__(.*?)(?<!\\)__/gm,
            'subscript': /(?<!\\):_(.*?)(?<!\\):/gm,
            'superscript': /(?<!\\):\^(.*?)(?<!\\):/gm
        },
        'cmd_line': {
            'stacked_scripts': /(?<!\\):_\^{(.*?)(?<!\\)}{(.*?)(?<!\\)}:/gm
        },
        'adv_line': {
            'hyperlink': /\[(.+)\]\((.+)\)/gm,
        },
        'commands': {
            'local_body': /:(\w+)(.*)/gm,
            'local_param': /{(.+?)}/gm
        },
        'header': /^(#+) *(.*)/mg,
        'globalcommand': /^\\(\w+)/gm
    }

    static #ValidGlobalCommands = [
        "AutoIndexHeaders",
        "EveryLineBreaks"
    ]

    static #GlobalFunctionCommands = {
        'ResetHeaderIndexes': function (headerLevelsObject) {
            for (const key of Object.keys(headerLevelsObject))
                headerLevelsObject[key] = 0;
        }
    }

    /**
     * 
     * @param {string} bodyText
     * @returns {?HTMLDivElement}
     */
    static ParseMyriMark(bodyText) {
        const workingBodyText = bodyText.replace(/\r/gm, '');
        const sections = this.Condense(this.BreakUp(workingBodyText));
        return this.#parse(sections);
    }

    /**
     * 
     * @param {Array.<string|string[]>} stringSections 
     * @param {HTMLDivElement} parent
     * @returns {?HTMLDivElement}
     */
    static #parse(stringSections, parent=null) {
        const body = document.createElement('div');
        for (const section of stringSections) {
            if (typeof section === 'string')
                this.ParseMyriMarkSection(section, body);
            else {
                this.#parse(section, body);
            }
        }
        if (parent) parent.append(body);
        else return body;
        return null;
    }

    /**
     * 
     * @param {string} myrimark_text
     * @param {HTMLDivElement} parent
     * @returns {?HTMLDivElement}
     */
    static ParseMyriMarkSection(myrimark_text, parent=null) {
        const body = this.RemoveExcessWhiteSpace(myrimark_text);
        const paragraphs = body.split(this.Regexes.seperators.paragraphs);
        const return_body = document.createElement('div');
        if (parent) parent.append(return_body);
        let header_levels = {
            "h1": 0,
            "h2": 0,
            "h3": 0,
            "h4": 0,
            "h5": 0,
            "h6": 0
        };
        let global_commands = []
        for (const paragraph of paragraphs) {
            const lines = paragraph.split('\n');
            const type = this.GetParagraphType(lines);
            switch (type) {
                case 'p':
                    return_body.append(this.MakeParagraph(lines, global_commands.includes('EveryLineBreaks')));
                break;
                case 'ol':
                    return_body.append(this.MakeList(lines, 'ol'));
                break;
                case 'ul':
                    return_body.append(this.MakeList(lines, 'ul'));
                break;
                case 'checks':
                    return_body.append(this.MakeChecks(lines));
                break;
                case 'null':
                break;
                case 'localcommand':
                    this.RegexSearch(paragraph, this.Regexes.commands.local_body, (g) => {
                        const cmd_name = g[1];
                        const cmd_param_string = g[2]
                        const element = this.MakeSingleLineCommand(cmd_name, cmd_param_string, return_body);
                            if (element) {
                                if (typeof element == 'string') return_body.innerHTML += element;
                                else return_body.append(element);
                            }
                    });
                break;
                case 'header':
                    this.RegexSearch(paragraph, this.Regexes.header, (g) => {
                        const header_level = g[1].length;
                        if (global_commands.includes('AutoIndexHeaders')) {
                            header_levels[`h${header_level}`]++;
                            for (let countdown = header_level+1; countdown<=6; countdown++)
                                header_levels[`h${countdown}`] = 0;
                        }
                        return_body.append(this.MakeHeader(header_level, g[2], global_commands, header_levels));
                    });
                break;
                case 'globalcommand':
                    for (const line of lines) {
                        const cmd = line.substring(1);
                        if (this.#ValidGlobalCommands.includes(cmd)) {
                            if (global_commands.includes(cmd))
                                global_commands.splice(global_commands.findIndex( (value)=>value===cmd ), 1);
                            else global_commands.push(cmd);
                        }
                        else if (Object.keys(this.#GlobalFunctionCommands).includes(cmd))
                            this.#GlobalFunctionCommands[cmd](header_levels);
                        else return_body.append(this.MakeParagraph([`INVALID GLOBAL COMMAND {${cmd}}`]));
                    }
                break;
            }
        }
        if (!parent) return return_body;
        else return null;
    }

    /**
     * Removes all the unneeded space at the begin and end
     * of the body, as well as each line.
     * @param {string} body 
     * @returns {string}
     */
    static RemoveExcessWhiteSpace(body) {
        let body_rm = body + '';
        body_rm = body_rm.replaceAll(/\r/gm, '');
        for (const regex of Object.values(this.Regexes.excess))
            body_rm = body_rm.replace(regex, '');
        return body_rm;
    }
    
    /**
     * Checks to see what type of paragraph is present
     * @param {string[]} lines 
     * @returns {string}
     */
    static GetParagraphType(lines) {
        if (lines.length === 1) {
            const line = lines[0];
            switch (line.charAt(0)) {
                case ':':
                return 'localcommand';
                case '#':
                return 'header';
                case '\\':
                return 'globalcommand';
                case '$':
                return 'null';
            }
        }
        let beginings = [];
        for (const line of lines) beginings.push(line.charAt(0));
        if (!this.allEqual(beginings)) return 'p';
        switch (beginings[0]) {
            case '*': 
            return 'ul'; 
            case '-': 
            return 'ol';
            case '>':
            return 'checks';
            case '#':
            return 'header';
            case '\\':
            return 'globalcommand';
            case ':':
            return 'localcommand';
            default:
            return 'p';
        }
    }

    static #LocalCommands = {
        /**
         * 
         * @param {HTMLDivElement} rb 
         * @param {string} url 
         * @param {number|string} scale 
         * @returns {HTMLImageElement}
         */
        'image': (rb, url, scale=1) => {
            if (typeof scale === 'string') scale = parseFloat(scale);
            const image = new Image();
            image.src = url;
            image.onload = () => {
                let width = image.width * scale;
                let height = image.height * scale;
                image.width = width;
                image.height = height;
            }
            return image;
        },
        'center': (rb, text) => {
            const div = document.createElement('div');
            div.classList.add('justify', 'center');
            div.append(this.ParseMyriMarkSection(text));
            return div;
        },
        /**
         * 
         * @param {HTMLDivElement} rb 
         * @param {string} color 
         */
        'background_color': (rb, color) => {
            rb.style.backgroundColor = color;
            return null;
        },
        /**
         * 
         * @param {HTMLDivElement} rb 
         * @param {string} amount 
         */
        'padding': (rb, amount) => {
            rb.style.padding = amount;
            return null;
        },
        /**
         * 
         * @param {HTMLDivElement} rb 
         * @param {string} amount 
         */
        'rounding': (rb, amount) => {
            rb.style.borderRadius = amount;
        },
        /**
         * 
         * @param {HTMLDivElement} rb 
         * @param {?string} text
         */
        'hl': (rb, text='') => {
            const span = document.createElement('span');
            span.classList.add('hl-text');
            span.innerText = text;
            return span;
        },
        /**
         * 
         * @param {HTMLDivElement} rb 
         */
        'begin': (rb, type, ...args) => {
            rb.classList.add(type);
            switch (type) {
                case 'multicol':
                    rb.style.columnCount = args[0];
                    rb.classList.add(...args.slice(1));
                break;
                case 'paragraph': 
                    rb.classList.add(...args);
                break;
            }
            return null;
        }
    }

    /**
     * 
     * @param {string} commandName 
     * @param {string} parameterString 
     * @param {HTMLDivElement} returnBody
     * @returns {HTMLElement|string|Text}
     */
    static MakeSingleLineCommand(commandName, parameterString, returnBody) {
        let parameters = this.RegexMatchContents(parameterString, this.Regexes.commands.local_param);
        if (!Object.keys(this.#LocalCommands).includes(commandName)) 
            return document.createTextNode(`${commandName} (${JSON.stringify(parameters)}) is not a valid local command.`);
        return this.#LocalCommands[commandName]((returnBody.parentElement) ? returnBody.parentElement : returnBody, ...parameters);
    }
    
    /**
     * Makes a header, level as the count.
     * @param {number} count 
     * @param {string} content
     * @param {string[]} globalCommands
     * @param {Object.<string, number>} headerIndexes
     * @returns {HTMLHeadingElement}
     */
    static MakeHeader(count, content, globalCommands, headerIndexes) {
        const header_type = `h${count}`;
        /** @type {HTMLHeadingElement} */
        // @ts-ignore
        const header = document.createElement(header_type);
        let header_index_string = [];
        if (globalCommands.includes('AutoIndexHeaders')) {
            let array = [];
            for (let num = 1; num<=count; num++) {
                array.push(headerIndexes[`h${num}`]);
            }
            // @ts-ignore
            header_index_string = array.join('.');
            // @ts-ignore
            header_index_string+=" ";
        }
        const innerHTML = header_index_string + content;
        header.innerHTML = this.FormatLine(innerHTML);
        return header;
    }

    /**
     * @callback RegexSearchCallback
     * @param {string[]} groups
     * @returns {void}
     */

    /**
     * 
     * @param {string} string 
     * @param {RegExp} regexReference
     * @param {RegexSearchCallback} callback 
     */
    static RegexSearch(string, regexReference, callback) {
        const regex = structuredClone(regexReference);
        let m;
        while ((m = regex.exec(string)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let groups = [];
            m.forEach((match) => { groups.push(match); });
            callback(groups);
        }
        return true;
    }

    /**
     * 
     * @param {string} string 
     * @param {RegExp} regexReference 
     */
    static RegexMatchContents(string, regexReference) {
        const regex = structuredClone(regexReference);
        let m, matches = [];
        while ((m = regex.exec(string)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let groups = [];
            m.forEach((match, groupIndex) => { if(groupIndex!==0) groups.push(match); });
            if (groups.length === 1)
                matches.push(groups[0])
            else matches.push(groups);
        }
        return matches;
    }

    /**
     * 
     * @param {string[]} lines 
     * @param {boolean} seperateLines
     * @returns {HTMLParagraphElement|HTMLDivElement}
     */
    static MakeParagraph(lines, seperateLines=false) {
        if (seperateLines) {
            const div = document.createElement('div');
            for (const line of lines) {
                const p = document.createElement('p');
                const innerHTML = this.FormatLine(line);
                p.innerHTML = innerHTML;
                div.append(p)
            }
            return div;
        } else {
            const p = document.createElement('p');
            const innerHTML = this.FormatLine(lines.join(' '));
            p.innerHTML = innerHTML;
            return p;
        }
    }

    /**
     * 
     * @param {string[]} lines 
     * @param {'ol'|'ul'} type
     * @returns {HTMLOListElement|HTMLUListElement}
     */
    static MakeList(lines, type) {
        const list = document.createElement(type);
        const joined = lines.join('\n');
        const regex = structuredClone(this.Regexes.list.li_content);
        let m;
        while ((m = regex.exec(joined)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let content = '';
            m.forEach((match, groupIndex) => { if (groupIndex === 1) content = match; });
            const li = document.createElement('li');
            const innerHTML = this.FormatLine(content);
            li.innerHTML = innerHTML;
            list.append(li);
        }
        return list;
    }

    /**
     * 
     * @param {string[]} lines
     * @returns {HTMLFormElement}
     */
    static MakeChecks(lines) {
        const form = document.createElement('form');
        const joined = lines.join('\n');
        const regex = structuredClone(this.Regexes.list.checkbox_content);
        let m;
        while ((m = regex.exec(joined)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let content = '';
            m.forEach((match, groupIndex) => { if (groupIndex === 1) content = match; });
            const input = document.createElement('input');
            input.type = 'checkbox';
            const p = document.createElement('span');
            const span = document.createElement('span');
            span.innerHTML = this.FormatLine(content);
            p.append(input, span, document.createElement('br'));
            form.append(p);
        }
        return form;
    }

    /**
     * Creates an input element,
     * \<input type={type} value={content}>
     * @param {string} content
     * @param {string} type
     */
    static MakeInput(content, type) {
        const input = document.createElement('input');
        input.type = type;
        //input.innerHTML = this.FormatLine(content);
        return input;
    }

    static MakeImage(url) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = url;
        return image;
    }

    /**
     * 
     * @param {string} line 
     * @returns {string}
     */
    static FormatLine(line) {
        let fline = line+'';
        //command-type styles
        for (const [type, regex] of Object.entries(this.Regexes.cmd_line)) {
            this.RegexSearch(fline, regex, (g) => {
                let filler;
                switch (type) {
                    case "stacked_scripts":
                        filler = `<span class="stacked"><span class="lower">${g[2]}</span><span class="upper">${g[1]}</span></span>`;
                    break;
                }
                fline = fline.replaceAll(g[0], filler);
            });
        }
        // regular styles
        for (const [type, fregex] of Object.entries(this.Regexes.line)) {
            const regex = structuredClone(fregex);
            let m;
            while ((m = regex.exec(fline)) !== null) {
                if (m.index === regex.lastIndex) regex.lastIndex++;
                let whole, content;
                m.forEach((match, groupIndex) => { 
                    if (groupIndex === 0) whole = match;
                    else if (groupIndex === 1) content = match; 
                });
                const formated = this.pluginTextEffect(this.FormatLine(content), type);
                fline = fline.replace(whole, formated);
            }
        }
        // hyperlinks
        const hyperlink_regex = structuredClone(this.Regexes.adv_line.hyperlink);
        let m_hyperlink;
        while ((m_hyperlink = hyperlink_regex.exec(fline)) !== null) {
            if (m_hyperlink.index === hyperlink_regex.lastIndex) hyperlink_regex.lastIndex++;
            let whole, text, link;
            m_hyperlink.forEach((match, groupIndex) => { 
                if (groupIndex === 0) whole = match;
                else if (groupIndex === 1) text = match;
                else if (groupIndex === 2) link = match;
            });
            const formated = `<a href="${link}">${this.FormatLine(text)}</a>`;
            fline = fline.replace(whole, formated);
        }
        for (const char of this.EscapedChars)
            fline=fline.replaceAll('\\'+char, char);
        return fline;
    }

    static EscapedChars = ['*', '_', '~', '/', '%', ':', '\\'];

    static pluginFrames = {
        'bold': 'b',
        'italic': 'i',
        'strikethrough': 's',
        'underline': 'u',
        'subscript': 'sub',
        'superscript': 'sup'
    }

    static pluginTextEffect(content, type) {
        return `<${this.pluginFrames[type]}>${content}</${this.pluginFrames[type]}>`;
    }

    //https://dev.to/rajnishkatharotiya/function-to-check-if-all-records-are-equal-in-array-javascript-3mo3
    static allEqual = arr => arr.every(val => val === arr[0]);
}

module.exports = {
    MyriMark
}