// app/(dashboard)/documents/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import { FileText, Upload, Folder, Download, Eye } from 'lucide-react'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'

export default function DocumentsPage() {
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const { hasPermission: canUpload } = usePermission(PERMISSIONS.DOCUMENTS.UPLOAD)
  const { hasPermission: canDeleteDocs } = usePermission(PERMISSIONS.DOCUMENTS.DELETE_ALL)
  // Mock data for now - you'll integrate with Supabase Storage in production
  const documents = [
    {
      id: '1',
      name: 'Employee Handbook 2025.pdf',
      size: '2.4 MB',
      type: 'PDF',
      uploaded_at: '2025-01-15',
      category: 'Policies',
    },
    {
      id: '2',
      name: 'Leave Policy.docx',
      size: '156 KB',
      type: 'Word',
      uploaded_at: '2025-01-10',
      category: 'Policies',
    },
    {
      id: '3',
      name: 'Payroll Schedule 2025.xlsx',
      size: '84 KB',
      type: 'Excel',
      uploaded_at: '2025-01-05',
      category: 'Finance',
    },
  ]

  const categories = ['All', 'Policies', 'Finance', 'HR', 'IT', 'Other']
  const [activeCategory, setActiveCategory] = useState('All')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    // TODO: Implement Supabase Storage upload when bucket is created
    // Uncomment below after creating the 'documents' bucket in Supabase Storage:

    /*
    const fileName = `${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (!error) {
      // Save metadata to documents table
      await supabase.from('documents').insert({
        name: file.name,
        file_path: data.path,
        size: file.size,
        type: file.type,
        category: activeCategory === 'All' ? 'Other' : activeCategory,
      })
    }
    */

    setTimeout(() => {
      setUploading(false)
      alert(`File "${file.name}" uploaded! (Mock - implement Supabase Storage)`)
    }, 1500)
  }

  const fileTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      PDF: 'bg-red-50 text-red-700 border-red-200',
      Word: 'bg-blue-50 text-blue-700 border-blue-200',
      Excel: 'bg-green-50 text-green-700 border-green-200',
      Image: 'bg-purple-50 text-purple-700 border-purple-200',
    }
    return colors[type] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Company documents and file repository"
        action={
          canUpload ? (
            <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                     rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
              <input
                type="file"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          ) : undefined
        }
      />

      {/* Storage Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">Storage Usage</p>
          <p className="text-sm text-gray-500">2.6 GB of 100 GB used</p>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: '2.6%' }} />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
          >
            <Folder className="w-4 h-4 inline mr-1.5" />
            {cat}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900">No documents yet</p>
          <p className="text-sm text-gray-500 mt-1">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Name</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Category</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Size</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Uploaded</th>
                <th className="text-right px-6 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border font-medium ${fileTypeColor(
                        doc.type
                      )}`}
                    >
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{doc.category}</td>
                  <td className="px-6 py-3 text-gray-600">{doc.size}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {new Date(doc.uploaded_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canDeleteDocs && (
                      <button className="p-1.5 text-gray-600 hover:bg-gray-50 rounded ml-1">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note about implementation */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> This is a UI mockup. To fully implement file uploads:
        </p>
        <ol className="text-sm text-amber-700 mt-2 ml-4 list-decimal space-y-1">
          <li>Go to Supabase → Storage → Create bucket named "documents"</li>
          <li>Uncomment the upload code in handleUpload function above</li>
          <li>Create a 'documents' table with the SQL in Phase 5 guide</li>
          <li>Set up RLS policies for the documents table</li>
        </ol>
      </div>
    </div>
  )
}