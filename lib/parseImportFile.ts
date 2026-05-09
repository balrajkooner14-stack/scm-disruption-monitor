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

        // Read ALL sheets and combine their data
        const allSheetData: Record<string, Record<string, string>[]> = {}
        const allHeaders: string[] = []

        sheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
            sheet,
            { defval: "" }
          )

          if (jsonData.length > 0) {
            allSheetData[sheetName] = jsonData.slice(0, 30)
            const sheetHeaders = Object.keys(jsonData[0])
            sheetHeaders.forEach(h => {
              if (!allHeaders.includes(h)) allHeaders.push(h)
            })
          }
        })

        // Build a combined rows array with a __sheet__ field
        // so AI knows which sheet each row came from
        const combinedRows: Record<string, string>[] = []
        Object.entries(allSheetData).forEach(([sheetName, rows]) => {
          rows.forEach(row => {
            combinedRows.push({ ...row, __sheet__: sheetName })
          })
        })

        resolve({
          headers: allHeaders,
          rows: combinedRows.slice(0, 80),
          rowCount: combinedRows.length,
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
  // Group rows back by sheet for clearer AI context
  if (data.sheetNames && data.sheetNames.length > 1) {
    const bySheet: Record<string, Record<string, string>[]> = {}

    data.rows.forEach(row => {
      const sheet = (row.__sheet__ as string) ?? "Sheet1"
      if (!bySheet[sheet]) bySheet[sheet] = []
      // Remove the __sheet__ meta field before sending to AI
      const { __sheet__, ...cleanRow } = row as Record<string, string>
      void __sheet__
      bySheet[sheet].push(cleanRow)
    })

    const preview = {
      fileType: data.fileType,
      totalSheets: data.sheetNames.length,
      sheetNames: data.sheetNames,
      totalRows: data.rowCount,
      sheets: Object.fromEntries(
        Object.entries(bySheet).map(([name, rows]) => [
          name,
          {
            rowCount: rows.length,
            columns: rows.length > 0 ? Object.keys(rows[0]) : [],
            sampleRows: rows.slice(0, 20),
          },
        ])
      ),
    }
    return JSON.stringify(preview, null, 2)
  }

  // Single sheet — use original format
  const cleanRows = data.rows.map(row => {
    const { __sheet__, ...rest } = row as Record<string, string>
    void __sheet__
    return rest
  })
  const preview = {
    columns: data.headers,
    sampleRows: cleanRows.slice(0, 20),
    totalRows: data.rowCount,
  }
  return JSON.stringify(preview, null, 2)
}
