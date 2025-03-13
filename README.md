# Myrimark: Markdown, LaTeX, & HTML Inspired Rich Text

Myrimark is the Myriware in-house markdown system for rich text,
encouraged for both users and developers to use.
It takes elements from Markdown, LaTeX, and HTML and combines them
in a rich fashion.
Below is the documentation for the different currently supported features.

Before you begin understanding what Myrimark can do, you must understand how
the processing engine for it work. Currently, there is only one JS file that
produces HTML code from the given Myrimark. Thus, a lot of what is possible
is because of the features of HTML.

## Syntax

First of all, everything exists in 'Paragraphs.' These are sections of 
code that are spereated by TWO or more newlines. Thus, if there is only
one new line, it will be added to the previous paragraph (just like Markdown/LaTex).

Some Paragraphs are special because they are used for lists, commands, or divisions.
These will be covered later. However, for the special paragraphs to register, the first
character of each line must be the SAME.

```
This is part of the first Paragraph.
This is also part of the first Paragraph.

This is part of the second Paragraph.
"Me as well!"

- I am a list
- So am I
- Me too!
```

## Basic Text

Below are the different basic text options, as well as their syntaxes.
Effects can be used inside of each other, so long that there are both
opening and closing sets of symbols.
Unlike HTML, the opening sets and the closing sets do not have to be within
only one: i.e. you can start a bold, start italics, end the bold, then end italics.

| Type        |       Syntax |
|-------------|--------------|
| Bold        | \*\*Text\*\* |
| Italics     | //Text//     |
| Underline   | \_\_Text\_\_ |
| Strike      | \~\~Text\~\~ |

## Lists

There are three main types of list: numbered, dotted, and checked.
Each one is as its name implies, and are consistered one of the 
special cases of Paragraphs. Each line in the Paragraph must start with
the same symbol, listed below.

| Symbol | Type     |
|--------|----------|
| *      | Dotted   |
| -      | Numbered |
| >      | Checked  |

## Commands

There are two types of commands: Global and local.
