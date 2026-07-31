$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$wb = $excel.Workbooks.Open("c:\Users\GIGA\LGHairUIUX\TestCase_DangNhap_DangKy_TC101_TC200.xlsx")
$ws = $wb.Sheets.Item(1)
$usedRange = $ws.UsedRange
$rows = $usedRange.Rows.Count
$cols = $usedRange.Columns.Count

$output = @()
$output += "Sheet: $($ws.Name)"
$output += "Rows: $rows, Cols: $cols"
$output += "========================"

for ($r = 1; $r -le $rows; $r++) {
    $line = ""
    for ($c = 1; $c -le $cols; $c++) {
        $val = $ws.Cells.Item($r, $c).Text
        if ($c -gt 1) { $line += "`t" }
        $line += $val
    }
    $output += $line
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$output | Out-File -FilePath "c:\Users\GIGA\LGHairUIUX\testcases_output.txt" -Encoding UTF8
Write-Host "Done! Output saved to testcases_output.txt"
