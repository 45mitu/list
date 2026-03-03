$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Server started on http://localhost:8080"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $url = $ctx.Request.Url.LocalPath
    if ($url -eq "/") { $url = "/index.html" }
    
    $basePath = "c:\Users\User\.gemini\test"
    $filePath = Join-Path $basePath ($url.TrimStart("/"))
    Write-Host "Request: $url -> $filePath"
    
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath)
        
        $contentType = switch ($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".css"  { "text/css; charset=utf-8" }
            ".js"   { "application/javascript; charset=utf-8" }
            default { "application/octet-stream" }
        }
        
        $ctx.Response.ContentType = $contentType
        $ctx.Response.ContentLength64 = $content.Length
        $ctx.Response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $ctx.Response.StatusCode = 404
        Write-Host "Not found: $filePath"
    }
    
    $ctx.Response.Close()
}
