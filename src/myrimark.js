/**
 * Provides a necessary class for the parsing of the Myrimark formate.
 * This object can take in a text, formated to Myrimark, and create
 * HTML that displays the content of the Myrimark. Should work cross-compatibly
 * (lookout for special parameters that are needed).
 */
export class Myrimark {

    /** @type {Document} A reference to a DOM object for cross-compatibility functions.*/
    #document;
    /** @type {Object.<string, number>} Stores the Levels for the headers when using auto indexing.*/
    #header_levels;
    /** @type {string[]} Stores all of the active commands, globally. */
    #global_commands;
    /** @type {Object.<string, string>} Stores strings that are used in command inputs */
    #strings={};
    /** @type {Object.<string, string[]>} User bin for storing info for the REPEAT local command */
    #objectStash={}

    /**
     * The Constructor for an object that is used to parse Myrimark.
     * @param {Document} doc For cross-compatablity purposes, 
     * this Class requires a reference to a DOM object for various functions.
     * If you are using this in the web, then you can safely ignore this field.
     */
    constructor (doc=null) {
        if (doc)
            this.#document = doc;
        // eslint-disable-next-line
        else this.#document = document;
    }

    /**
     * Finds all divs with class 'myrimark-container', and parses
     * their text and replaces it with the parsed Myrimark text.
     */
    ParsePageMyriMarkDivs() {
        const divs = this.#document.querySelectorAll("div.myrimark-container");
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
    #condense(array) {
        let return_array = [];
        let string = "";
        for (const ele of array) {
            if (typeof ele === 'string')
                string += ele+'\n'
            else {
                return_array.push(string);
                return_array.push(this.#condense(ele))
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
    #breakUp(body) {
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
                    working[working.length-1] = this.#breakUp(
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

    #Regexes = {
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
            'stacked_scripts': /(?<!\\):_\^{(.*?)(?<!\\)}{(.*?)(?<!\\)}:/gm,
            'code_line': /(?<!\\)`(.*?)(?<!\\)`/gm
        },
        'adv_line': {
            'hyperlink': /\[(.+)\]\((.+)\)/gm,
        },
        'commands': {
            'local_body': /:(\w+)(.*)/gm,
            'local_param': /{(.+?)}/gm
        },
        'header': /^(#+) *(.*)/mg,
        'globalcommand': /^\\(\w+)/gm,
        'block_comments': /(?<!\\)%\[.*(?<!\\)\]%/gm,
        'singleline_comments': / *(?<!\\)%%.*$/gm,
        'strings': /(?<={)"([\w\W]*?)"(?=})/gm
    }

    #ValidGlobalCommands = [
        "AutoIndexHeaders",
        "EveryLineBreaks",
        "HideImageErrors"
    ]

    #GlobalFunctionCommands = {
        'ResetHeaderIndexes': function (headerLevelsObject) {
            for (const key of Object.keys(headerLevelsObject))
                headerLevelsObject[key] = 0;
        }
    }

    #SimpleGlobalSymbols = {
        '\n\n': /(?<!\\)\\par\b/gm,
        '\u0009': /(?<!\\)\\indent\b/gm
    }

    /**
     * Replaces Global Symbols with their respective symbols.
     * @param {string} text Input Myrimark.
     * @returns {string}
     */
    #replaceGlobalSymbols(text) {
        let return_text = text;
        for (const [replace, symbol] of Object.entries(this.#SimpleGlobalSymbols)) {
            return_text = return_text.replace(symbol, replace);
        }
        return return_text;
    }

    /**
     * Removes the text from a string.
     * @param {string} text 
     * @returns {string}
     */
    #removeComments(text) {
        let return_text = text;
        this.regexSearch(text, this.#Regexes.block_comments, (g) => {
            return_text = return_text.replace(g[0], '');
        });
        this.regexSearch(text, this.#Regexes.singleline_comments, (g) => {
            return_text = return_text.replace(g[0], '');
        });
        return return_text;
    }
    /**
     * Replaces all command inputs strings
     * with an identifier.
     * @param {string} input 
     * @returns {string}
     */
    #stashStrings(input) {
        let output = input;
        this.regexSearch(output, this.#Regexes.strings, (gs) => {
            const sid = "0x" + Object.keys(this.#strings).length;
            this.#strings[sid] = gs[1];
            output = output.replace(gs[0], sid);
        });
        return output;
    }

    /**
     * Takes a string of text, and parses it for Myrimark. 
     * If there is nothing that fits
     * Myrimark, or there is an error, it will return null.
     * @param {string} bodyText Text that will be parsed as Myrimark.
     * @returns {?HTMLDivElement}
     */
    ParseMyriMark(bodyText) {
        // Remove unwanted information
        let workingBodyText = bodyText.replace(/\r/gm, '');
        workingBodyText = this.#removeComments(workingBodyText);
        this.#strings = {};
        this.#objectStash={};
        workingBodyText = this.#stashStrings(workingBodyText);
        // Begin parsing
        const sections = this.#condense(this.#breakUp(workingBodyText));
        this.#header_levels = {
            "h1": 0,
            "h2": 0,
            "h3": 0,
            "h4": 0,
            "h5": 0,
            "h6": 0
        };
        this.#global_commands = [];
        return this.#parse(sections, null);
    }

    /**
     * 
     * @param {Array.<string|string[]>} stringSections 
     * @param {HTMLDivElement} parent
     * @returns {?HTMLDivElement}
     */
    #parse(stringSections, parent=null) {
        const body = this.#document.createElement('div');
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
     * Parses a section of Myrimark. DOES NOT account for nesting.
     * Do not use this funciton unless there is no nesting.
     * @param {string} myrimark_text Text to be parsed.
     * @param {HTMLDivElement} parent Parent element used for nesting.
     * @returns {?HTMLDivElement}
     */
    ParseMyriMarkSection(myrimark_text, parent=null) {
        let body = this.#removeExcessWhiteSpace(myrimark_text);
        body = this.#replaceGlobalSymbols(body);
        const paragraphs = body.split(this.#Regexes.seperators.paragraphs);
        const return_body = this.#document.createElement('div');
        if (parent) parent.append(return_body);
        for (const paragraph of paragraphs) {
            const lines = paragraph.split('\n');
            const type = this.#getParagraphType(lines);
            switch (type) {
                case 'p':
                    return_body.append(this.#makeParagraph(lines, this.#global_commands.includes('EveryLineBreaks')));
                break;
                case 'ol':
                    return_body.append(this.#makeList(lines, 'ol'));
                break;
                case 'ul':
                    return_body.append(this.#makeList(lines, 'ul'));
                break;
                case 'checks':
                    return_body.append(this.#makeChecks(lines));
                break;
                case 'code':
                    return_body.append(this.#makeCodeBlock(lines));
                break;
                case 'null':
                break;
                case 'localcommand':
                    this.regexSearch(paragraph, this.#Regexes.commands.local_body, (g) => {
                        const cmd_name = g[1];
                        const cmd_param_string = g[2]
                        const element = this.#makeSingleLineCommand(cmd_name, cmd_param_string, return_body);
                            if (element) {
                                if (typeof element == 'string') return_body.innerHTML += element;
                                else return_body.append(element);
                            }
                    });
                break;
                case 'header':
                    this.regexSearch(paragraph, this.#Regexes.header, (g) => {
                        const header_level = g[1].length;
                        if (this.#global_commands.includes('AutoIndexHeaders')) {
                            this.#header_levels[`h${header_level}`]++;
                            for (let countdown = header_level+1; countdown<=6; countdown++)
                                this.#header_levels[`h${countdown}`] = 0;
                        }
                        return_body.append(this.#makeHeader(header_level, g[2]));
                    });
                break;
                case 'globalcommand':
                    for (const line of lines) {
                        const cmd = line.substring(1);
                        if (this.#ValidGlobalCommands.includes(cmd)) {
                            if (this.#global_commands.includes(cmd))
                                this.#global_commands.splice(this.#global_commands.findIndex( (value)=>value===cmd ), 1);
                            else this.#global_commands.push(cmd);
                        }
                        else if (Object.keys(this.#GlobalFunctionCommands).includes(cmd))
                            this.#GlobalFunctionCommands[cmd](this.#header_levels);
                        else return_body.append(this.#makeParagraph([`INVALID GLOBAL COMMAND {${cmd}}`]));
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
    #removeExcessWhiteSpace(body) {
        let body_rm = body + '';
        body_rm = body_rm.replaceAll(/\r/gm, '');
        for (const regex of Object.values(this.#Regexes.excess))
            body_rm = body_rm.replace(regex, '');
        return body_rm;
    }
    
    /**
     * Checks to see what type of paragraph is present
     * @param {string[]} lines 
     * @returns {string}
     */
    #getParagraphType(lines) {
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
                case '`':
                return 'code';
            }
        }
        let beginings = [];
        for (const line of lines) beginings.push(line.charAt(0));
        if (!this.#allEqual(beginings)) return 'p';
        switch (beginings[0]) {
            case '*': 
            return 'ul'; 
            case '-': 
            return 'ol';
            case '>':
            return 'checks';
            case '#':
            return 'header';
            case '`':
            return 'code';
            case '\\':
            return 'globalcommand';
            case ':':
            return 'localcommand';
            default:
            return 'p';
        }
    }

    #LocalCommands = {
        /**
         * ChatGPT modified.
         * @param {HTMLDivElement} rb 
         * @param {string} url 
         * @param {number|string} scale 
         * @returns {HTMLImageElement}
         */
        'image': (rb, url, scale = 1) => {
            if (typeof scale === 'string') scale = parseFloat(scale);
            const container = this.#document.createElement('div');

            const image = this.#document.createElement('img');
            image.src = url;
            image.style.display = 'none'; // Hide initially

            const errorText = this.#document.createElement('span');
            errorText.textContent = 'Error: Unable to load image: ' + url;
            errorText.style.color = 'red';
            errorText.style.display = 'none';

            image.onload = () => {
                let width = image.width * scale;
                let height = image.height * scale;
                image.width = width;
                image.height = height;
                image.style.display = 'block'; // Show the image
                errorText.style.display = 'none'; // Hide error text
            };

            image.onerror = () => {
                image.style.display = 'none'; // Hide image
                if (!this.#global_commands.includes('HideImageErrors'))
                    errorText.style.display = 'block'; // Show error text
            };

            container.appendChild(image);
            container.appendChild(errorText);
            
            return container;
        },
        /**
         * 
         * @param {HTMLDivElement} rb 
         * @param {string} id 
         * @param {string} title
         */
        'anchor': (rb, id, text) => {
            const p = this.#document.createElement('p');
            p.id = id;
            p.innerText = this.#formatLine(text);
            return p;
        },
        'center': (rb, text) => {
            const div = this.#document.createElement('div');
            div.classList.add('justify', 'center');
            div.append(this.ParseMyriMarkSection(text, null));
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
         * @param {string} color 
         */
        'text_color': (rb, color) => {
            rb.style.color = color;
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
            const span = this.#document.createElement('span');
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
        },
        'vardump': (rb) => {
            const pre = this.#document.createElement('pre');
            pre.innerHTML = JSON.stringify(this.#strings, null, 2);
            pre.innerHTML += JSON.stringify(this.#objectStash, null, 2);
            return pre;
        },
        /**
         * 
         * @param {*} rb 
         * @param {string} varname 
         * @param {string} valueString 
         */
        'stash': (rb, varname, valueString) => {
            let list = [];
            this.regexSearch(valueString, /'(.*?)'/gm, (gs) => {
                list.push(gs[1]);
            });
            this.#objectStash[varname] = list;
            return `<p>STASHED ${varname} with ${JSON.stringify(list)}</p>`;
        },
        /**
         * 
         * @param {*} rb 
         * @param {string} commandString 
         * @param {string} listName 
         * @param {string} optionalCommands
         */
        'repeat': (rb, commandString, listName, optionalCommands="") => {
            let local_myrimark=optionalCommands+"\n\n";
            for (const item of this.#objectStash[listName]) {
                local_myrimark+=commandString.replaceAll('|$|', item)+"\n";
            }
            return this.ParseMyriMark(local_myrimark);
        }
    }

    /**
     * 
     * @param {string} commandName 
     * @param {string} parameterString 
     * @param {HTMLDivElement} returnBody
     * @returns {HTMLElement|string|Text}
     */
    #makeSingleLineCommand(commandName, parameterString, returnBody) {
        let parameterStringWorking = parameterString;
        let parameters = this.#regexMatchContents(parameterStringWorking, this.#Regexes.commands.local_param);
        for (let i=0; i<parameters.length; i++) {
            this.regexSearch(parameters[i], /0x(\d+)/gm, (gs) => {
                parameters[i] = this.#strings[gs[0]];
            });
        }
        if (!Object.keys(this.#LocalCommands).includes(commandName)) 
            return this.#document.createTextNode(`${commandName} (${JSON.stringify(parameters)}) is not a valid local command.`);
        return this.#LocalCommands[commandName]((returnBody.parentElement) ? returnBody.parentElement : returnBody, ...parameters);
    }
    
    /**
     * Makes a header, level as the count.
     * @param {number} count 
     * @param {string} content
     * @returns {HTMLHeadingElement}
     */
    #makeHeader(count, content) {
        const header_type = `h${count}`;
        /** @type {HTMLHeadingElement} */
        // @ts-ignore
        const header = this.#document.createElement(header_type);
        let header_index_string = [];
        if (this.#global_commands.includes('AutoIndexHeaders')) {
            let array = [];
            for (let num = 1; num<=count; num++) {
                array.push(this.#header_levels[`h${num}`]);
            }
            // @ts-ignore
            header_index_string = array.join('.');
            // @ts-ignore
            header_index_string+=" ";
        }
        const innerHTML = header_index_string + content;
        header.innerHTML = this.#formatLine(innerHTML);
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
    regexSearch(string, regexReference, callback) {
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
     * @returns {string[]}
     */
    #regexMatchContents(string, regexReference) {
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
    #makeParagraph(lines, seperateLines=false) {
        if (seperateLines) {
            const div = this.#document.createElement('div');
            for (const line of lines) {
                const p = this.#document.createElement('p');
                const innerHTML = this.#formatLine(line);
                p.innerHTML = innerHTML;
                div.append(p)
            }
            return div;
        } else {
            const p = this.#document.createElement('p');
            const innerHTML = this.#formatLine(lines.join(' '));
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
    #makeList(lines, type) {
        const list = this.#document.createElement(type);
        const joined = lines.join('\n');
        const regex = structuredClone(this.#Regexes.list.li_content);
        let m;
        while ((m = regex.exec(joined)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let content = '';
            m.forEach((match, groupIndex) => { if (groupIndex === 1) content = match; });
            const li = this.#document.createElement('li');
            const innerHTML = this.#formatLine(content);
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
    #makeChecks(lines) {
        const form = this.#document.createElement('form');
        const joined = lines.join('\n');
        const regex = structuredClone(this.#Regexes.list.checkbox_content);
        let m;
        while ((m = regex.exec(joined)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let content = '';
            m.forEach((match, groupIndex) => { if (groupIndex === 1) content = match; });
            const input = this.#document.createElement('input');
            input.type = 'checkbox';
            const p = this.#document.createElement('span');
            const span = this.#document.createElement('span');
            span.innerHTML = this.#formatLine(content);
            p.append(input, span, this.#document.createElement('br'));
            form.append(p);
        }
        return form;
    }
    
    /**
     * 
     * @param {string[]} lines
     * @returns {HTMLPreElement}
     */
    #makeCodeBlock(lines) {
        const block = this.#document.createElement('pre');
        block.innerHTML = lines.join('\n')
        .replace(/^\` */gm, '')
        .replace(/(?<!\\)\/sp\//gm, '')
        .replaceAll('<', '&gt;');
        return block;
    }

    /**
     * 
     * @param {string} line 
     * @returns {string}
     */
    #formatLine(line) {
        let fline = line+'';
        //command-type styles
        for (const [type, regex] of Object.entries(this.#Regexes.cmd_line)) {
            this.regexSearch(fline, regex, (g) => {
                let filler;
                switch (type) {
                    case "stacked_scripts":
                        filler = `<span class="stacked"><span class="lower">${g[2]}</span><span class="upper">${g[1]}</span></span>`;
                    break;
                    case 'code_line':
                        filler = `<pre class="inline-code">${g[1]}</pre>`
                    break;
                }
                fline = fline.replaceAll(g[0], filler);
            });
        }
        // regular styles
        for (const [type, fregex] of Object.entries(this.#Regexes.line)) {
            const regex = structuredClone(fregex);
            let m;
            while ((m = regex.exec(fline)) !== null) {
                if (m.index === regex.lastIndex) regex.lastIndex++;
                let whole, content;
                m.forEach((match, groupIndex) => { 
                    if (groupIndex === 0) whole = match;
                    else if (groupIndex === 1) content = match; 
                });
                const formated = this.#pluginTextEffect(this.#formatLine(content), type);
                fline = fline.replace(whole, formated);
            }
        }
        // hyperlinks
        const hyperlink_regex = structuredClone(this.#Regexes.adv_line.hyperlink);
        let m_hyperlink;
        while ((m_hyperlink = hyperlink_regex.exec(fline)) !== null) {
            if (m_hyperlink.index === hyperlink_regex.lastIndex) hyperlink_regex.lastIndex++;
            let whole, text, link;
            m_hyperlink.forEach((match, groupIndex) => { 
                if (groupIndex === 0) whole = match;
                else if (groupIndex === 1) text = match;
                else if (groupIndex === 2) link = match;
            });
            const formated = `<a href="${link}">${this.#formatLine(text)}</a>`;
            fline = fline.replace(whole, formated);
        }
        for (const char of this.#EscapedChars)
            fline=fline.replaceAll('\\'+char, char);
        return fline;
    }

    #EscapedChars = ['*', '_', '~', '/', '%', ':', '\\'];

    #PluginFrames = {
        'bold': 'b',
        'italic': 'i',
        'strikethrough': 's',
        'underline': 'u',
        'subscript': 'sub',
        'superscript': 'sup'
    }

    /**
     * 
     * @param {string} content 
     * @param {string} type 
     * @returns {string}
     */
    #pluginTextEffect(content, type) {
        return `<${this.#PluginFrames[type]}>${content}</${this.#PluginFrames[type]}>`;
    }

    //https://dev.to/rajnishkatharotiya/function-to-check-if-all-records-are-equal-in-array-javascript-3mo3
    #allEqual = arr => arr.every(val => val === arr[0]);
}