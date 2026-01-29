import React, { useEffect, useState, useRef } from 'react'
import { Modal, Spin } from 'antd'
import DocViewer, { DocViewerRenderers } from 'react-doc-viewer'
import type { IDocument } from 'react-doc-viewer'
import CustomPDFRenderer from './pdf'
import CustomMarkdownRenderer from './markdown'
import CustomDocxRenderer from './docx'

export interface FileRenderDocument extends IDocument {
  fileName?: string
  filePath?: string // Add filePath support
  metadata?: {
    pageNumber?: number
  }
  // Standard IDocument has uri and fileData.
  // We add 'file' for direct File object support which some custom renderers might use.
  file?: File | Blob
}

interface FileRenderProps {
  open: boolean
  documents: FileRenderDocument[]
  onCancel: () => void
}

const FileRender: React.FC<FileRenderProps> = React.memo(({ open, documents, onCancel }) => {
  FileRender.displayName = 'FileRender'
  const [loadedDocuments, setLoadedDocuments] = useState<FileRenderDocument[]>([])
  const [loading, setLoading] = useState(false)

  // Use ref to track created URLs for cleanup, avoiding closure stale state issues
  const createdUrlsRef = useRef<string[]>([])
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Cleanup previous URLs when documents change or modal closes
    const cleanupUrls = () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      createdUrlsRef.current = []
    }

    if (!open || !documents || documents.length === 0) {
      cleanupUrls()
      setLoadedDocuments([])
      return
    }

    const loadFiles = async () => {
      setLoading(true)

      // Cleanup previous URLs before loading new ones
      cleanupUrls()

      try {
        const newDocs = await Promise.all(
          documents.map(async (doc) => {
            // If already has file object, return as is
            if (doc.file) return doc

            // If has filePath, load it via IPC
            if (doc.filePath) {
              try {
                const buffer = await window.api.readFile(doc.filePath)
                // Convert Uint8Array to ArrayBuffer for Blob. Explicitly cast buffer to any to avoid TS issues with SharedArrayBuffer in some envs
                const blob = new Blob([buffer as any], {
                  type: getMimeType(doc.fileName || doc.filePath || '')
                })

                // Create a File object if possible, or just use Blob with name
                const file = new File([blob], doc.fileName || 'document', {
                  type: getMimeType(doc.fileName || doc.filePath || '')
                })

                // Create object URL for uri (required by react-doc-viewer)
                const objectUrl = URL.createObjectURL(file)
                createdUrlsRef.current.push(objectUrl)

                return {
                  ...doc,
                  uri: objectUrl,
                  file: file,
                  fileType: getFileType(doc.fileName || doc.filePath || '')
                }
              } catch (e) {
                console.error('Failed to load file:', doc.filePath, e)
                return doc
              }
            }

            return doc
          })
        )

        if (isMountedRef.current) {
          setLoadedDocuments(newDocs)
        } else {
          // If unmounted, cleanup immediately
          cleanupUrls()
        }
      } catch (error) {
        console.error('Error loading documents:', error)
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    loadFiles()

    // Cleanup on unmount or re-run
    return () => {
      // We don't revoke here immediately if it's just a re-render,
      // but we do if the component is unmounting or dependency changing.
      // However, since we are cleaning up at the start of the effect,
      // we only need to ensure cleanup on unmount.
      // But useEffect cleanup runs before the next effect run.
      // So we can just rely on the next run's cleanup or explicit cleanup call.

      // Actually, to be safe and avoid memory leaks if the component unmounts:
      // We should verify if we want to cleanup.
      // The cleanup function runs:
      // 1. Before re-running the effect (dependencies changed)
      // 2. When component unmounts

      // If dependencies changed, we want to cleanup old URLs.
      // If unmounts, we want to cleanup.
      // So yes, we should cleanup here.
      // BUT, we need to be careful not to cleanup URLs that are still being used if the logic was slightly different.
      // In this case, we regenerate everything when documents/open changes, so it is safe to cleanup.

      // However, there is a race condition:
      // loadFiles is async. If the effect cleanup runs while loadFiles is pending,
      // we need to make sure we don't set state, AND we cleanup any URLs created in that pending promise.
      // We handle "don't set state" via isMountedRef.
      // We handle "cleanup created URLs" via logic inside loadFiles (if !isMountedRef.current cleanup).

      // For URLs created in previous successful runs:
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      createdUrlsRef.current = []
    }
  }, [documents, open])

  // Helper to guess mime type
  const getMimeType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return 'application/pdf'
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      case 'md':
        return 'text/markdown'
      default:
        return 'application/octet-stream'
    }
  }

  // Helper to guess file extension for react-doc-viewer
  const getFileType = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || ''
  }

  // If no documents, don't render anything (or render empty modal)
  if (!documents || documents.length === 0) {
    return null
  }

  return (
    <Modal
      className="file-preview-modal"
      width="90vw"
      style={{ top: 20 }}
      styles={{ body: { height: '85vh', padding: 0, overflow: 'hidden' } }}
      destroyOnClose
      footer={null}
      centered
      title={documents[0]?.fileName || 'File Viewer'}
      open={open}
      onCancel={onCancel}
    >
      {loading ? (
        <div className="h-full w-full flex items-center justify-center">
          <Spin size="large" tip="Loading file..." />
        </div>
      ) : (
        <DocViewer
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          documents={loadedDocuments}
          pluginRenderers={[
            CustomPDFRenderer,
            CustomMarkdownRenderer,
            CustomDocxRenderer,
            ...DocViewerRenderers
          ]}
          config={{
            header: {
              disableHeader: true,
              disableFileName: true,
              retainURLParams: false
            }
          }}
        />
      )}
    </Modal>
  )
})

export default FileRender
