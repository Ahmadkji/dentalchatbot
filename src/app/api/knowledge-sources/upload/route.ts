import { createKnowledgeSource, getDefaultClinic } from '@/lib/clinic-data'
import { extractTextFromUploadedFile } from '@/lib/knowledge-import'
import { NextRequest, NextResponse } from 'next/server'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.csv']

export async function POST(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max size is 5 MB.' }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    if (!SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, TXT, or CSV.' }, { status: 400 })
    }

    const content = await extractTextFromUploadedFile(file)

    if (!content.trim()) {
      return NextResponse.json({ error: 'No readable text found in file.' }, { status: 400 })
    }

    const source = await createKnowledgeSource({
      clinicId: clinic.id,
      title: file.name,
      type: 'file',
      content,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
    })

    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    console.error('Error uploading knowledge file:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to upload file' }, { status: 500 })
  }
}
