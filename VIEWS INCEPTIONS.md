---
author: beto.group
name.official: Views Inceptions
price: "0"
category:
  - utility
tags:
  - developer-tool
  - sandbox
  - component-loader
  - testing
  - props-editor
  - prototyping
  - isolation
  - debug
  - escape-prevention
desc: An advanced developer sandbox for dynamically loading, isolating, and interacting with other Datacore components using live prop injection.
status: stable
complexity: advanced
id: 18
resources:
  - assets/viewsinceptions.clip.gif
  - assets/views_inception_1.webp
  - assets/views_inception_2.webp
longDesc: An advanced developer utility designed to dynamically load, render, and interact with any other Datacore component within a secure, isolated "sandbox." This upgraded version introduces a powerful props editor, allowing developers to pass custom properties to the loaded component and see the changes reflected instantly. It provides a robust testing and rapid prototyping environment that prevents the loaded component from interfering with the Obsidian interface.
version.obsidian: 1.4.11
version: 2.0.6
---

# Views Inceptions

```datacorejsx
const activeFile = dc.resolvePath("VIEWS INCEPTIONS.md") || "_RESOURCES/DATACORE/VIEWS INCEPTIONS/VIEWS INCEPTIONS.md";
const folderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));
const { View } = await dc.require(folderPath + "/src/index.jsx");
return await View({ folderPath, dc });
```