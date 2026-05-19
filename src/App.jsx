const { useState, useEffect, useRef } = dc;

function SimpleComponentLoader({ folderPath, dc }) {
    const [DynamicComponentLoader, setDynamicComponentLoader] = useState(null);
    const [componentName, setComponentName] = useState("");
    const [loadedComponentName, setLoadedComponentName] = useState("");
    const [componentProps, setComponentProps] = useState({});
    const [renderKey, setRenderKey] = useState(0);
    const [exampleComponents, setExampleComponents] = useState([]);
    const [isFullTab, setIsFullTab] = useState(true); 
    
    const [propsEditorOpen, setPropsEditorOpen] = useState(false);
    const [propsList, setPropsList] = useState([]); 
    const [newPropInput, setNewPropInput] = useState('');
    const [showDebug, setShowDebug] = useState(false);
    
    const containerRef = useRef(null);
    const stateRefs = useRef({}).current;
    
    useEffect(() => {
        let active = true;
        const loadDependencies = async () => {
            try {
                const mod = await dc.require(folderPath + "/src/components/DynamicComponentLoader.jsx");
                if (active) {
                    setDynamicComponentLoader(() => mod.DynamicComponentLoader);
                }
            } catch (err) {
                console.error("[SimpleComponentLoader] Error loading DynamicComponentLoader:", err);
            }
        };
        loadDependencies();
        return () => { active = false; };
    }, [folderPath]);

    const parsePropValue = (valueStr) => {
        try {
            let cleanValue = valueStr.trim();
            if (cleanValue.startsWith('{') && cleanValue.endsWith('}')) {
                cleanValue = cleanValue.slice(1, -1).trim();
            }
            const result = eval('(' + cleanValue + ')');
            return result;
        } catch (e) {
            return valueStr;
        }
    };
    
    const addNewProp = () => {
        const trimmed = newPropInput.trim();
        if (!trimmed) return;
        
        const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (!match) {
            if (typeof Notice !== 'undefined') {
                new Notice('Invalid format. Use: propName={value} or propName="value"', 3000);
            }
            return;
        }
        
        const [, key, valueStr] = match;
        const value = parsePropValue(valueStr);
        
        if (propsList.some(p => p.key === key)) {
            if (typeof Notice !== 'undefined') {
                new Notice(`Prop "${key}" already exists. Double-click to edit it.`, 3000);
            }
            return;
        }
        
        const newPropsList = [...propsList, { key, value, isEditing: false, displayValue: valueStr }];
        setPropsList(newPropsList);
        setNewPropInput('');
        
        const newProps = { ...componentProps, [key]: value };
        setComponentProps(newProps);
        setRenderKey(prev => prev + 1);
    };
    
    const removeProp = (key) => {
        const newPropsList = propsList.filter(p => p.key !== key);
        setPropsList(newPropsList);
        
        const newProps = { ...componentProps };
        delete newProps[key];
        setComponentProps(newProps);
        setRenderKey(prev => prev + 1);
    };
    
    const startEditProp = (key) => {
        setPropsList(propsList.map(p => 
            p.key === key ? { ...p, isEditing: true } : p
        ));
    };
    
    const updateProp = (key, newValueStr) => {
        const newValue = parsePropValue(newValueStr);
        const newPropsList = propsList.map(p => 
            p.key === key ? { ...p, value: newValue, displayValue: newValueStr, isEditing: false } : p
        );
        setPropsList(newPropsList);
        
        const newProps = { ...componentProps, [key]: newValue };
        setComponentProps(newProps);
        setRenderKey(prev => prev + 1);
    };
    
    const cancelEditProp = (key) => {
        setPropsList(propsList.map(p => 
            p.key === key ? { ...p, isEditing: false } : p
        ));
    };
    
    useEffect(() => {
        const allFiles = app.vault.getMarkdownFiles();
        const componentFiles = allFiles.filter(file => 
            file.path.includes('VIEWS INCEPTIONS/example') &&
            file.path.endsWith('.component.md')
        );
        
        const seen = new Set();
        const examples = [];
        
        for (const file of componentFiles) {
            const fileName = file.name.replace('.md', '');
            const parts = fileName.split('.');
            const componentName = parts[2] || parts[1]; 
            
            if (!seen.has(componentName)) {
                seen.add(componentName);
                examples.push({
                    name: componentName.charAt(0).toUpperCase() + componentName.slice(1),
                    queryName: componentName 
                });
            }
        }
        
        setExampleComponents(examples.sort((a, b) => a.name.localeCompare(b.name)));
    }, []);
    
    // Full-tab mode DOM manipulation helper
    function findNearestAncestorWithClass(element, className) {
      if (!element) return null;
      let current = element.parentNode;
      while (current) {
        if (current.classList && current.classList.contains(className)) return current;
        current = current.parentNode;
      }
      return null;
    }

    function findDirectChildByClass(parent, className) {
      if (!parent) return null;
      for (const child of parent.children) {
        if (child.classList && child.classList.contains(className)) return child;
      }
      return null;
    }

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isFullTab) return;
        
        const targetPaneContent = findNearestAncestorWithClass(container, "workspace-leaf-content");
        if (!targetPaneContent) return;
        
        const contentWrapper = findDirectChildByClass(targetPaneContent, "view-content") || targetPaneContent;
        
        stateRefs.originalParent = container.parentNode;
        stateRefs.placeholder = document.createElement("div");
        stateRefs.placeholder.style.display = "none";
        container.parentNode.insertBefore(stateRefs.placeholder, container);
        
        stateRefs.parentPositionInfo = {
            element: contentWrapper,
            original: window.getComputedStyle(contentWrapper).position,
        };
        if (stateRefs.parentPositionInfo.original === "static") {
            contentWrapper.style.position = "relative";
        }
        
        contentWrapper.appendChild(container);
        Object.assign(container.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            zIndex: "9998",
            backgroundColor: "var(--background-primary)",
            overflow: "auto",
        });
        
        return () => {
            if (stateRefs.placeholder?.parentNode) {
                stateRefs.placeholder.parentNode.replaceChild(container, stateRefs.placeholder);
            }
            if (stateRefs.parentPositionInfo?.element) {
                stateRefs.parentPositionInfo.element.style.position =
                    stateRefs.parentPositionInfo.original === "static" ? "" : stateRefs.parentPositionInfo.original;
            }
            container.removeAttribute("style");
            Object.keys(stateRefs).forEach((key) => (stateRefs[key] = null));
        };
    }, [isFullTab]);

    const handleLoadComponent = (e) => {
        e.preventDefault();
        if (!componentName.trim()) return;
        setLoadedComponentName(componentName.trim());
        setRenderKey(prev => prev + 1);
    };
    
    const handleQuickLoad = (example) => {
        setComponentName(example.queryName);
        setLoadedComponentName(example.queryName);
        setRenderKey(prev => prev + 1);
    };
    
    const handleClearComponent = () => {
        setLoadedComponentName("");
        setRenderKey(prev => prev + 1);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        let droppedText = e.dataTransfer.getData('text/plain');
        let droppedPath = droppedText;

        if (droppedText && (droppedText.startsWith('obsidian://') || droppedText.includes('file='))) {
            try {
                const queryString = droppedText.includes('?') ? droppedText.split('?')[1] : droppedText;
                const params = new URLSearchParams(queryString);
                const fileParam = params.get('file');
                if (fileParam) droppedPath = decodeURIComponent(fileParam);
            } catch (err) {
                console.warn("Failed to parse Obsidian URI:", err);
            }
        }
        
        if (droppedPath) {
             droppedPath = droppedPath.replace(/^\[\[|\]\]$/g, '');
             if (droppedPath.includes('|')) {
                 droppedPath = droppedPath.split('|')[0];
             }
        }
        
        if (droppedPath) {
            const fileName = droppedPath.split('/').pop();
            const baseName = fileName.replace(/\.md$/, '');
            let nameToUse = "";
            const parts = baseName.split('.');
            const markerIndex = parts.findIndex(p => p === 'component' || p === 'viewer');
            
            if (markerIndex > 0) {
                nameToUse = parts[markerIndex - 1];
            } else {
                nameToUse = baseName;
            }
            
            if (nameToUse) {
                setComponentName(nameToUse);
                setLoadedComponentName(nameToUse);
                setRenderKey(prev => prev + 1);
                if (typeof Notice !== 'undefined') new Notice(`Loaded component: ${nameToUse}`);
            }
        }
    };

    const mainWrapperStyle = {
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: '#0a0a0a',
        overflow: 'hidden'
    };

    const controlPanelStyle = {
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(15, 15, 15, 0.98) 0%, rgba(10, 10, 10, 1) 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(60, 60, 60, 0.3)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
        flexShrink: 0
    };

    const displayAreaStyle = {
        flex: 1,
        padding: '24px',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: '#000000'
    };

    const spawnBoxStyle = {
        width: '100%',
        height: '100%',
        background: 'rgba(15, 15, 15, 0.6)',
        border: '2px dashed rgba(80, 80, 80, 0.3)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: 'rgba(160, 160, 160, 0.5)',
        fontSize: '18px',
        fontWeight: '600',
        backdropFilter: 'blur(10px)',
        boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.2)',
        overflow: 'auto'
    };

    const formStyle = { maxWidth: '800px', margin: '0 auto' };
    const inputStyle = {
        flex: 1,
        padding: '12px 16px',
        background: 'rgba(20, 20, 20, 0.8)',
        border: '1px solid rgba(80, 80, 80, 0.3)',
        borderRadius: '10px',
        color: '#e0e0e0',
        fontSize: '14px',
        transition: 'all 0.3s ease',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const buttonStyle = {
        padding: '12px 32px',
        background: 'linear-gradient(135deg, rgba(40, 40, 40, 0.8) 0%, rgba(30, 30, 30, 0.9) 100%)',
        border: '1px solid rgba(160, 118, 249, 0.15)',
        borderRadius: '10px',
        color: '#e0e0e0',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexShrink: 0
    };

    const titleStyle = {
        fontSize: '22px',
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: '20px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
    };

    const labelStyle = {
        fontSize: '12px',
        fontWeight: '600',
        color: 'rgba(200, 200, 200, 0.7)',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const formRowStyle = {
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        alignItems: 'center'
    };
    
    const exampleButtonStyle = {
        padding: '10px 16px',
        background: 'rgba(40, 40, 40, 0.6)',
        border: '1px solid rgba(80, 80, 80, 0.4)',
        borderRadius: '8px',
        color: '#c0c0c0',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'system-ui, -apple-system, sans-serif'
    };

    return (
        <div 
            ref={containerRef} 
            style={mainWrapperStyle}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <div style={controlPanelStyle}>
                <div style={formStyle}>
                    <h2 style={titleStyle}>
                        <dc.Icon icon="box" style={{ fontSize: '24px' }} />
                        <span>Component Loader</span>
                    </h2>
                    
                    {exampleComponents.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>
                                <dc.Icon icon="zap" style={{ fontSize: '14px' }} />
                                <span>Quick Load Examples</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {exampleComponents.map((example, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleQuickLoad(example)}
                                        style={exampleButtonStyle}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = 'rgba(60, 60, 60, 0.8)';
                                            e.target.style.transform = 'translateY(-2px)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(160, 118, 249, 0.1)';
                                            e.target.style.borderColor = 'rgba(160, 118, 249, 0.25)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'rgba(40, 40, 40, 0.6)';
                                            e.target.style.transform = 'translateY(0)';
                                            e.target.style.boxShadow = 'none';
                                            e.target.style.borderColor = 'rgba(80, 80, 80, 0.4)';
                                        }}
                                    >
                                        {example.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={handleLoadComponent}>
                        <div style={formRowStyle}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>
                                    <dc.Icon icon="package" style={{ fontSize: '12px' }} />
                                    <span>Component Name</span>
                                </label>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="e.g., lottieexperiment, kanban, d3jstest"
                                        value={componentName}
                                        onChange={(e) => setComponentName(e.target.value)}
                                        style={inputStyle}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'rgba(160, 118, 249, 0.3)';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(160, 118, 249, 0.05)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'rgba(80, 80, 80, 0.3)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        required
                                    />
                                    <button 
                                        type="submit" 
                                        style={buttonStyle}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = 'linear-gradient(135deg, rgba(60, 60, 60, 0.9) 0%, rgba(50, 50, 50, 1) 100%)';
                                            e.target.style.transform = 'translateY(-2px)';
                                            e.target.style.boxShadow = '0 6px 24px rgba(160, 118, 249, 0.15)';
                                            e.target.style.borderColor = 'rgba(160, 118, 249, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'linear-gradient(135deg, rgba(40, 40, 40, 0.8) 0%, rgba(30, 30, 30, 0.9) 100%)';
                                            e.target.style.transform = 'translateY(0)';
                                            e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4)';
                                            e.target.style.borderColor = 'rgba(160, 118, 249, 0.15)';
                                        }}
                                    >
                                        <dc.Icon icon="play" style={{ fontSize: '16px' }} />
                                        <span>Load Component</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '16px' }}>
                            <div 
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 12px',
                                    background: 'rgba(20, 20, 20, 0.8)',
                                    border: '1px solid rgba(80, 80, 80, 0.3)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                                onClick={() => setPropsEditorOpen(!propsEditorOpen)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(30, 30, 30, 0.9)';
                                    e.currentTarget.style.borderColor = 'rgba(160, 118, 249, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(20, 20, 20, 0.8)';
                                    e.currentTarget.style.borderColor = 'rgba(80, 80, 80, 0.3)';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <dc.Icon 
                                        icon={propsEditorOpen ? "chevron-down" : "chevron-right"} 
                                        style={{ fontSize: '14px', color: 'rgba(200, 200, 200, 0.7)' }} 
                                    />
                                    <dc.Icon icon="braces" style={{ fontSize: '12px', color: 'rgba(200, 200, 200, 0.7)' }} />
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#e0e0e0' }}>
                                        Component Props
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '11px',
                                    color: 'rgba(160, 118, 249, 0.8)',
                                    background: 'rgba(160, 118, 249, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                }}>
                                    {propsList.length} {propsList.length === 1 ? 'prop' : 'props'}
                                </span>
                            </div>
                            
                            {propsEditorOpen && (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    background: 'rgba(15, 15, 15, 0.6)',
                                    border: '1px solid rgba(80, 80, 80, 0.3)',
                                    borderRadius: '8px',
                                }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '11px' }}>
                                            <dc.Icon icon="plus" style={{ fontSize: '10px' }} />
                                            <span>Add New Prop</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder='e.g., title="Hello" or count={5}'
                                                value={newPropInput}
                                                onChange={(e) => setNewPropInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addNewProp();
                                                    }
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    background: 'rgba(20, 20, 20, 0.8)',
                                                    border: '1px solid rgba(80, 80, 80, 0.3)',
                                                    borderRadius: '6px',
                                                    color: '#e0e0e0',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    outline: 'none',
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={addNewProp}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: 'linear-gradient(135deg, rgba(40, 40, 40, 0.8) 0%, rgba(30, 30, 30, 0.9) 100%)',
                                                    border: '1px solid rgba(160, 118, 249, 0.15)',
                                                    borderRadius: '6px',
                                                    color: '#e0e0e0',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {propsList.length === 0 ? (
                                        <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(140, 140, 140, 0.6)', fontSize: '12px' }}>
                                            No props set. Add one above.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {propsList.map((prop) => (
                                                <div
                                                    key={prop.key}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '8px 10px',
                                                        background: 'rgba(20, 20, 20, 0.8)',
                                                        border: '1px solid rgba(80, 80, 80, 0.3)',
                                                        borderRadius: '6px',
                                                    }}
                                                >
                                                    <span style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '12px',
                                                        color: 'rgba(160, 118, 249, 0.9)',
                                                        fontWeight: '600',
                                                        minWidth: '60px',
                                                    }}>
                                                        {prop.key}=
                                                    </span>
                                                    
                                                    {prop.isEditing ? (
                                                        <input
                                                            type="text"
                                                            defaultValue={prop.displayValue}
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') updateProp(prop.key, e.target.value);
                                                                else if (e.key === 'Escape') cancelEditProp(prop.key);
                                                            }}
                                                            onBlur={(e) => updateProp(prop.key, e.target.value)}
                                                            style={{
                                                                flex: 1,
                                                                padding: '4px 8px',
                                                                background: 'rgba(30, 30, 30, 0.9)',
                                                                border: '1px solid rgba(160, 118, 249, 0.4)',
                                                                borderRadius: '4px',
                                                                color: '#e0e0e0',
                                                                fontSize: '12px',
                                                                fontFamily: 'monospace',
                                                                outline: 'none',
                                                            }}
                                                        />
                                                    ) : (
                                                        <span
                                                            style={{
                                                                flex: 1,
                                                                fontFamily: 'monospace',
                                                                fontSize: '12px',
                                                                color: '#c0c0c0',
                                                                cursor: 'pointer',
                                                            }}
                                                            onDoubleClick={() => startEditProp(prop.key)}
                                                            title="Double-click to edit"
                                                        >
                                                            {prop.displayValue}
                                                        </span>
                                                    )}
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => removeProp(prop.key)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: 'rgba(220, 38, 38, 0.7)',
                                                            fontSize: '14px',
                                                            cursor: 'pointer',
                                                            borderRadius: '4px',
                                                            transition: 'all 0.2s ease',
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {propsList.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPropsList([]);
                                                setComponentProps({});
                                                setRenderKey(prev => prev + 1);
                                            }}
                                            style={{
                                                width: '100%',
                                                marginTop: '12px',
                                                padding: '8px',
                                                background: 'rgba(220, 38, 38, 0.15)',
                                                border: '1px solid rgba(220, 38, 38, 0.3)',
                                                borderRadius: '6px',
                                                color: '#ef4444',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Clear All Props
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
            
            <div style={displayAreaStyle}>
                <div style={spawnBoxStyle}>
                    {loadedComponentName ? (
                        <div 
                            className="component-sandbox-isolator"
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: '#050505',
                                overflow: 'hidden',
                                isolation: 'isolate',
                                border: '1px solid rgba(60, 60, 60, 0.2)'
                            }}
                        >
                            {showDebug && (
                                <div style={{
                                    position: 'absolute',
                                    top: '12px',
                                    left: '12px',
                                    maxWidth: '400px',
                                    background: 'rgba(0, 0, 0, 0.95)',
                                    border: '2px solid #00ff00',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    zIndex: 10001,
                                    fontFamily: 'monospace',
                                    fontSize: '11px',
                                    color: '#00ff00',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #00ff00', paddingBottom: '4px' }}>
                                        <strong>🐛 LIVE DEBUG</strong>
                                        <button 
                                            onClick={() => setShowDebug(false)}
                                            style={{ background: 'transparent', border: 'none', color: '#ff0000', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
                                        >×</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div><strong>Component:</strong> {loadedComponentName}</div>
                                        <div><strong>RenderKey:</strong> {renderKey}</div>
                                        <div><strong>Props Count:</strong> {Object.keys(componentProps).length}</div>
                                        <div style={{ borderTop: '1px solid #00ff00', paddingTop: '4px', marginTop: '4px' }}>
                                            <strong>PropsList:</strong>
                                            {propsList.length === 0 ? (
                                                <div style={{ color: '#ff9900', marginLeft: '8px' }}>Empty</div>
                                            ) : (
                                                <div style={{ marginLeft: '8px' }}>
                                                    {propsList.map((p, i) => (
                                                        <div key={i}>{p.key}: {JSON.stringify(p.value)} ({typeof p.value})</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ borderTop: '1px solid #00ff00', paddingTop: '4px', marginTop: '4px' }}>
                                            <strong>Props Object:</strong>
                                            {Object.keys(componentProps).length === 0 ? (
                                                <div style={{ color: '#ff9900', marginLeft: '8px' }}>Empty {'{}'}</div>
                                            ) : (
                                                <div style={{ marginLeft: '8px' }}>
                                                    {Object.entries(componentProps).map(([key, value]) => (
                                                        <div key={key}>{key}: {JSON.stringify(value)} ({typeof value})</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {!showDebug && (
                                <button
                                    onClick={() => setShowDebug(true)}
                                    style={{
                                        position: 'absolute',
                                        top: '12px',
                                        left: '12px',
                                        padding: '6px 10px',
                                        background: 'rgba(160, 118, 249, 0.08)',
                                        border: '1px solid rgba(160, 118, 249, 0.15)',
                                        borderRadius: '6px',
                                        color: 'rgba(160, 118, 249, 0.6)',
                                        fontSize: '10px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        zIndex: 10000,
                                        fontFamily: 'monospace',
                                        opacity: '0.5',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    🐛
                                </button>
                            )}
                            
                            <button
                                onClick={handleClearComponent}
                                style={{
                                    position: 'absolute',
                                    top: '12px',
                                    right: '12px',
                                    padding: '8px 16px',
                                    background: 'rgba(40, 40, 40, 0.8)',
                                    border: '1px solid rgba(220, 38, 38, 0.3)',
                                    borderRadius: '8px',
                                    color: '#ef4444',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    zIndex: 10000,
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <dc.Icon icon="x" style={{ fontSize: '14px' }} />
                                <span>Close</span>
                            </button>
                            
                            <div 
                                className="workspace-leaf-content component-sandbox-boundary"
                                data-sandbox="true"
                                style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    overflow: 'hidden',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    contain: 'layout style paint',
                                    zIndex: 1
                                }}
                            >
                                <div 
                                    className="view-content"
                                    style={{ 
                                        width: '100%', 
                                        height: '100%', 
                                        overflow: 'auto', 
                                        padding: '60px 20px 20px 20px',
                                        position: 'relative',
                                        flex: 1
                                    }}
                                >
                                    {DynamicComponentLoader && (
                                        <DynamicComponentLoader 
                                            componentName={loadedComponentName} 
                                            componentProps={componentProps}
                                            renderKey={renderKey} 
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <dc.Icon icon="package-open" style={{ fontSize: '48px', color: 'rgba(140, 140, 140, 0.4)' }} />
                            <div style={{ fontSize: '16px', color: 'rgba(180, 180, 180, 0.6)' }}>Components will appear here</div>
                            {exampleComponents.length > 0 && (
                                <div style={{ fontSize: '13px', color: 'rgba(140, 140, 140, 0.5)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <dc.Icon icon="arrow-up" style={{ fontSize: '14px' }} />
                                    <span>Try the quick load buttons above!</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

return { App: SimpleComponentLoader };
