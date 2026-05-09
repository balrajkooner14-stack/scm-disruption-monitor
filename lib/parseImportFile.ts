import * as XLSX from "xlsx"
import Papa from "papaparse"

export interface ParsedFileData {
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
  fileType: "excel" | "csv"
  sheetNames?: string[]
}

export async function parseFile(file: File): Promise<ParsedFileData> {
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "csv") {
    return parseCSV(file)
  } else if (extension === "xlsx" || extension === "xls") {
    return parseExcel(file)
  } else {
    throw new Error("Unsupported file type. Please upload CSV or Excel.")
  }
}

function parseCSV(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const rows = results.data
        resolve({
          headers,
          rows: rows.slice(0, 50),
          rowCount: rows.length,
          fileType: "csv",
        })
      },
      error: (error) => reject(error),
    })
  })
}

function parseExcel(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetNames = workbook.SheetNames

        const firstSheet = workbook.Sheets[sheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
          firstSheet,
          { defval: "" }
        )

        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : []

        resolve({
          headers,
          rows: jsonData.slice(0, 50),
          rowCount: jsonData.length,
          fileType: "excel",
          sheetNames,
        })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsBinaryString(file)
  })
}

export function prepareForAI(data: ParsedFileData): string {
  const preview = {
    columns: data.headers,
    sampleRows: data.rows.slice(0, 20),
    totalRows: data.rowCount,
  }
  return JSON.stringify(preview, null, 2)
}
