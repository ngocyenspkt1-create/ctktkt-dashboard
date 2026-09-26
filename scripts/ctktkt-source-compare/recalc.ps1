param([Parameter(Mandatory = $true)][string]$Source, [Parameter(Mandatory = $true)][string]$Target)
# Mở file bằng Excel, tính lại toàn bộ công thức và lưu thành .xlsx để openpyxl đọc được giá trị.
$source = (Resolve-Path $Source).Path
$target = [IO.Path]::GetFullPath($Target)
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Open($source, 0, $true)
  $xl.CalculateFull()
  $wb.SaveAs($target, 51)
  $wb.Close($false)
  "Đã tính lại: $target"
} finally {
  $xl.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
