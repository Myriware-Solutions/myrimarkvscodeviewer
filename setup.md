# Myrimark Developement

To set up the developemnt evirement, you need
to first install and set up a few things:

* Typescript
* VSCE
* Recomended Extensions
* Node
* Node packages

Here are the folling npm commands you should follow.

```console
npm install --save-exact --save-dev esbuild
npm install typescript --save-dev
npm install -g @vscode/vsce

npm install
```

or

```
npm install --save-exact --save-dev esbuild &
npm install typescript --save-dev &
npm install -g @vscode/vsce
```

To build the application, you can run the following code in the terminal:

```console
vsce package
````

So for some reason this only works in a Linux envirement. So, if you're in windows,
use a WSL2 and settup the whole ordeal in there. IDK if this works on Mac.

Everything from there should work.