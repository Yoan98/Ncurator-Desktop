import React, { useEffect } from 'react';
import jsPreviewDocx from "@js-preview/docx";
import '@js-preview/docx/lib/index.css'
import './index.css';

const CustomDocxRenderer = ({ mainState }) => {
    const { currentDocument } = mainState;

    useEffect(() => {
        if (!currentDocument) return;

        const initHtmlContent = async () => {
            let file = currentDocument.file;
            if (!file && currentDocument.uri) {
                try {
                    const res = await fetch(currentDocument.uri);
                    file = await res.blob();
                } catch (e) {
                    console.error("Failed to fetch docx", e);
                    return;
                }
            }

            if (!file) return;

            const docxEle = document.getElementById('my-docx-renderer');
            if (!docxEle) return;
            
            // Clear previous content if any? 
            // jsPreviewDocx.init appends? Or replaces? 
            // Usually it expects an empty container or handles it.
            // Let's assume it handles it or we clear it.
            docxEle.innerHTML = '';
            
            const myDocxPreviewer = jsPreviewDocx.init(docxEle);
            myDocxPreviewer.preview(file);
        };

        initHtmlContent();
    }, [currentDocument]);

    if (!currentDocument) return null;

    return (
        <div id="my-docx-renderer" className="docx-content w-full h-full overflow-auto bg-white p-8 shadow-sm">
        </div>
    );
};

CustomDocxRenderer.fileTypes = ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
CustomDocxRenderer.weight = 1;

export default CustomDocxRenderer;
