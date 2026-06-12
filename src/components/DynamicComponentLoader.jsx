const { useState, useEffect, useRef } = dc;
const { Component: PreactComponent } = dc.preact;

function ErrorDisplay({ errorMessage }) {
    const errorStyles = {
        wrapper: { padding: '20px' },
        details: {
            fontFamily: 'sans-serif',
            border: '1px solid #c53030',
            borderRadius: '8px',
            backgroundColor: '#2d1c1c',
            color: '#fed7d7',
            padding: '16px',
        },
        summary: {
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            color: '#f56565',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
        },
        summaryText: { marginLeft: '8px' },
        content: {
            marginTop: '12px',
            borderTop: '1px solid #742a2a',
            paddingTop: '12px',
            color: '#e0e0e0',
            fontSize: '14px',
        },
        pre: {
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: '#ccc',
            fontSize: '13px',
            marginTop: '12px',
            padding: '10px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            fontFamily: 'monospace',
        }
    };

    return (
        <div style={errorStyles.wrapper}>
            <details style={errorStyles.details} open>
                <summary style={errorStyles.summary}>
                    <dc.Icon icon="alert-triangle" style={{ marginRight: '8px' }} />
                    <span style={errorStyles.summaryText}>Component Error</span>
                </summary>
                <div style={errorStyles.content}>
                    <p>Failed to render component.</p>
                    <pre style={errorStyles.pre}>{errorMessage}</pre>
                </div>
            </details>
        </div>
    );
}

class ErrorBoundary extends PreactComponent {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("ErrorBoundary caught an error:", error, info);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.renderKey !== this.props.renderKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return <ErrorDisplay errorMessage={this.state.error?.toString()} />;
        }
        return this.props.children;
    }
}

function DynamicComponentLoader(props) {
    const componentName = props.componentName;
    const renderKey = props.renderKey;
    const componentProps = props.componentProps || {};
    const [LoadedComponent, setLoadedComponent] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const sandboxRef = useRef(null);

    // DOM Mutation Observer to track and PREVENT full-tab escapes
    useEffect(() => {
        if (!LoadedComponent) return;

        const sandboxBoundary = document.querySelector('.component-sandbox-isolator');
        if (!sandboxBoundary) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('component-render-root')) {
                            const escapedElement = document.querySelector('.component-render-root');
                            if (escapedElement && !sandboxBoundary.contains(escapedElement)) {
                                const viewContent = sandboxBoundary.querySelector('.view-content');
                                if (viewContent) {
                                    viewContent.appendChild(escapedElement);
                                    if (escapedElement.style.position === 'absolute') {
                                        escapedElement.style.position = 'relative';
                                    }
                                }
                            }
                        }
                    });
                }
            });
        });

        observer.observe(sandboxBoundary, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });

        return () => observer.disconnect();
    }, [LoadedComponent]);

    useEffect(() => {
        let isCancelled = false;

        const loadComponent = async () => {
            if (!componentName) {
                setLoadedComponent(null);
                setLoadError(null);
                setIsLoading(false);
                return;
            }

            setLoadedComponent(null);
            setLoadError(null);
            setIsLoading(true);

            let originalGetActiveFile = null;
            let originalRequire = null;

            try {
                const allFiles = app.vault.getMarkdownFiles();
                const matchingFiles = allFiles.filter(file => {
                    const name = file.name.toLowerCase();
                    const search = componentName.toLowerCase();
                    const isMatch = name.includes(search);
                    const isType = name.includes('.component') || name.includes('.viewer');
                    return isMatch && isType && file.name.endsWith('.md');
                });

                if (matchingFiles.length === 0) {
                    const looseMatches = allFiles.filter(file =>
                        file.name.toLowerCase().includes(componentName.toLowerCase()) &&
                        file.name.endsWith('.md')
                    );
                    if (looseMatches.length > 0) {
                        matchingFiles.push(...looseMatches);
                    }
                }

                if (matchingFiles.length === 0) {
                    throw new Error(`No component found matching "${componentName}" in vault`);
                }

                matchingFiles.sort((a, b) => {
                    let scoreA = (a.name.includes('.viewer') ? 2 : 0) + (a.name.includes('.component') ? 1 : 0);
                    let scoreB = (b.name.includes('.viewer') ? 2 : 0) + (b.name.includes('.component') ? 1 : 0);
                    
                    const folderPath = props.folderPath;
                    if (folderPath) {
                        const targetExample = folderPath + "/example";
                        if (a.path.includes(targetExample)) scoreA += 1000;
                        if (b.path.includes(targetExample)) scoreB += 1000;
                        
                        if (a.path.includes(folderPath)) scoreA += 500;
                        if (b.path.includes(folderPath)) scoreB += 500;
                    }
                    
                    if (a.path.includes('VIEWS INCEPTIONS/example')) scoreA += 200;
                    if (b.path.includes('VIEWS INCEPTIONS/example')) scoreB += 200;
                    
                    return scoreB - scoreA;
                });

                const file = matchingFiles[0];
                const filePath = file.path;
                const calculatedFolderPath = filePath.substring(0, filePath.lastIndexOf('/'));
                const mockFile = {
                    path: `${calculatedFolderPath}/mock-viewer.md`,
                    basename: 'mock-viewer',
                    extension: 'md',
                    parent: { path: calculatedFolderPath }
                };

                originalGetActiveFile = app.workspace.getActiveFile;
                const stubbedGetActiveFile = () => mockFile;
                app.workspace.getActiveFile = stubbedGetActiveFile;

                if (typeof dc !== 'undefined' && dc.app && dc.app !== app) {
                    dc.app.workspace.getActiveFile = stubbedGetActiveFile;
                }

                originalRequire = dc.require;
                dc.require = async (requirePath) => {
                    try {
                        return await originalRequire.call(dc, requirePath);
                    } catch (err) {
                        if (typeof requirePath === 'string' && err.message.includes('Could not find a script')) {
                            if (requirePath.includes('/src/src/')) {
                                const fixedPath = requirePath.replace('/src/src/', '/src/');
                                return await originalRequire.call(dc, fixedPath);
                            }
                            if (!requirePath.endsWith('.jsx') && !requirePath.endsWith('.js') && !requirePath.endsWith('.ts') && !requirePath.endsWith('.tsx') && !requirePath.endsWith('.md')) {
                                const fixedPath = requirePath + '.md';
                                return await originalRequire.call(dc, fixedPath);
                            }
                        }
                        throw err;
                    }
                };

                const fileContent = await app.vault.read(file);
                const resolvedPath = dc.resolvePath(filePath);
                const headerMatch = fileContent.match(/^#+\s+([^\r\n]+)/m);

                let dynamicModule = null;
                let loadedViaManual = false;

                try {
                    let headerToUse = null;
                    if (headerMatch) {
                        headerToUse = headerMatch[1].trim();
                    } else if (fileContent.includes('# ViewComponent') || fileContent.includes('## ViewComponent')) {
                        headerToUse = "ViewComponent";
                    }

                    if (headerToUse) {
                        dynamicModule = await dc.require(dc.headerLink(resolvedPath, headerToUse));
                    } else {
                        try {
                            dynamicModule = await dc.require(dc.headerLink(resolvedPath, "ViewComponent"));
                        } catch (defaultErr) {
                            dynamicModule = await dc.require(resolvedPath);
                        }
                    }
                } catch (requireErr) {
                    const codeBlockMatch = fileContent.match(/```(?:datacorejsx|jsx|js|ts|tsx)\r?\n([\s\S]*?)\r?\n```/);
                    if (codeBlockMatch) {
                        let code = codeBlockMatch[1];
                        if (code.includes('<')) {
                            code = code.replace(/<([A-Z]\w*)\s*\/>/g, 'dc.preact.h($1, null)');
                            code = code.replace(/<([A-Z]\w*)\s*>\s*<\/\1>/g, 'dc.preact.h($1, null)');
                            code = code.replace(/<([A-Z]\w*)\s+folderPath=\{([^}]+)\}\s*\/>/g, 'dc.preact.h($1, {folderPath: $2})');
                        }

                        try {
                            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                            const manualFn = new AsyncFunction('dc', 'app', code);
                            dynamicModule = await manualFn(dc, app);
                            loadedViaManual = true;
                        } catch (manualErr) {
                            throw new Error(`Failed to load component. \nRequire error: ${requireErr.message}\nManual error: ${manualErr.message}`);
                        }
                    } else {
                        throw new Error("No header and no valid code block found in file.");
                    }
                }

                if (isCancelled) return;

                let FactoryOrComp = null;
                if (loadedViaManual) {
                    FactoryOrComp = dynamicModule;
                } else {
                    if (typeof dynamicModule === 'function') {
                        FactoryOrComp = dynamicModule;
                    } else if (dynamicModule && typeof dynamicModule === 'object') {
                        const keys = Object.keys(dynamicModule);
                        if (keys.length > 0) FactoryOrComp = dynamicModule[keys[0]];
                    }
                }

                if (!FactoryOrComp) {
                    throw new Error("Module did not export a renderable component.");
                }

                let FinalComp = FactoryOrComp;
                if (typeof FinalComp === 'object' && FinalComp !== null) {
                    const vnode = FinalComp;
                    FinalComp = () => vnode;
                }

                if (typeof FactoryOrComp === 'function' && !loadedViaManual && (FactoryOrComp.length > 0 || FactoryOrComp.constructor.name === 'AsyncFunction')) {
                    try {
                        const result = await FactoryOrComp({ folderPath: calculatedFolderPath });
                        if (typeof result === 'function') {
                            FinalComp = result;
                        } else if (result && typeof result === 'object') {
                            FinalComp = () => result;
                        }
                    } catch (err) {
                        console.error("[DynamicLoader] Failed to execute component factory:", err);
                    }
                }

                if (!isCancelled) {
                    setLoadedComponent(() => FinalComp);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("[Component Error]", err);
                if (!isCancelled) {
                    setLoadError(err.toString());
                    setIsLoading(false);
                }
            } finally {
                if (originalGetActiveFile) {
                    app.workspace.getActiveFile = originalGetActiveFile;
                }
                if (typeof dc !== 'undefined' && dc.app) {
                    dc.app.workspace.getActiveFile = originalGetActiveFile;
                }
                if (originalRequire) {
                    dc.require = originalRequire;
                }
            }
        };

        loadComponent();
        return () => { isCancelled = true; };
    }, [componentName, renderKey]);

    if (isLoading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><dc.Icon icon="loader-2" style={{ width: '32px', height: '32px' }} /></div>
                <div>Loading component...</div>
            </div>
        );
    }

    if (loadError) {
        return <ErrorDisplay errorMessage={loadError} />;
    }

    if (LoadedComponent) {
        return (
            <div ref={sandboxRef} className="component-render-root">
                <ErrorBoundary renderKey={renderKey}>
                    <LoadedComponent
                        key={`component-${renderKey}`}
                        {...componentProps}
                    />
                </ErrorBoundary>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><dc.Icon icon="package" style={{ width: '32px', height: '32px', opacity: 0.6 }} /></div>
            <div>Select a component to load</div>
        </div>
    );
}

return { ErrorDisplay, ErrorBoundary, DynamicComponentLoader };
