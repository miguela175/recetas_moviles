$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api'
$results = @()

function Call($method, $path, $body, $token) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $params = @{ Method = $method; Uri = "$base$path"; Headers = $headers; ContentType = 'application/json' }
  if ($body) { $params['Body'] = ($body | ConvertTo-Json -Depth 8) }
  try {
    return Invoke-RestMethod @params
  } catch {
    $resp = $_.Exception.Response
    $code = [int]$resp.StatusCode
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $content = $reader.ReadToEnd()
    return @{ __error = $true; status = $code; body = $content }
  }
}
function Check($name, $cond) {
  $script:results += [pscustomobject]@{ Test = $name; OK = $cond }
}

# 1. Health
$h = Call 'GET' '/health' $null $null
Check 'Health endpoint' ($h.success -eq $true)

# 2/3. Registro + login
$u1 = Call 'POST' '/auth/register' @{ name='Cesar'; email='cesar@test.com'; password='123456' } $null
Check 'Registro usuario 1' ($u1.data.token.Length -gt 10)
$t1 = $u1.data.token
$login = Call 'POST' '/auth/login' @{ email='cesar@test.com'; password='123456' } $null
Check 'Login usuario 1' ($login.data.token.Length -gt 10)

# 4/5. Perfil + edicion
$me = Call 'GET' '/users/me' $null $t1
Check 'GET perfil' ($me.data.email -eq 'cesar@test.com')
$upd = Call 'PUT' '/users/me' @{ name='Cesar R.' } $t1
Check 'Editar perfil' ($upd.data.name -eq 'Cesar R.')

# 6/7. Grupos
$g1 = Call 'POST' '/groups' @{ name='Postres'; description='Dulces' } $t1
$g2 = Call 'POST' '/groups' @{ name='Cenas' } $t1
Check 'Crear grupo Postres' ($g1.data._id.Length -gt 0)
Check 'Crear grupo Cenas' ($g2.data._id.Length -gt 0)
$g1id = $g1.data._id; $g2id = $g2.data._id
$dupG = Call 'POST' '/groups' @{ name='postres' } $t1
Check 'Grupo duplicado rechazado (409)' ($dupG.status -eq 409)

# 8/9. Receta en dos grupos
$r1 = Call 'POST' '/recipes' @{
  title='Tarta de chocolate'; description='Rica'; category='Postre'; difficulty='Intermedia';
  timeMinutes=90; servings=8;
  ingredients=@(@{name='Chocolate';quantity='200';unit='g'}, @{name='Harina';quantity='100';unit='g'});
  steps=@('Derretir el chocolate','Mezclar','Hornear');
  groups=@($g1id,$g2id)
} $t1
Check 'Crear receta en 2 grupos' ($r1.data.groups.Count -eq 2)

# 10. Duplicado por titulo
$dupR = Call 'POST' '/recipes' @{ title='tarta de chocolate' } $t1
Check 'Receta duplicada rechazada (409)' ($dupR.status -eq 409)

# 11. Otra receta
$r2 = Call 'POST' '/recipes' @{ title='Arroz con pollo'; ingredients=@(@{name='Arroz';quantity='500';unit='g'}); steps=@('Cocinar'); groups=@($g2id) } $t1
Check 'Crear segunda receta' ($r2.data._id.Length -gt 0)

# 12/13. Recetas personales ordenadas alfabeticamente
$mine = Call 'GET' '/recipes?mine=true' $null $t1
Check 'Mis recetas: 2 items' ($mine.data.Count -eq 2)
Check 'Orden alfabetico (Arroz < Tarta)' ($mine.data[0].title -eq 'Arroz con pollo')

# 14. Detalle grupo
$gd = Call 'GET' "/groups/$g1id" $null $t1
Check 'Detalle grupo Postres con 1 receta' ($gd.data.recipes.Count -eq 1)

# 15. Quitar receta de un grupo (desvincular, no borrar)
$det = Call 'DELETE' "/groups/$g2id/recipes/$($r2.data._id)" $null $t1
$gd2 = Call 'GET' "/groups/$g2id" $null $t1
$stillExists = Call 'GET' "/recipes/$($r2.data._id)" $null $t1
# El grupo "Cenas" aun conserva "Tarta" (que pertenece a 2 grupos); solo se quito "Arroz"
Check 'Receta desvinculada del grupo' ($gd2.data.recipes.Count -eq 1)
Check 'Receta NO borrada al desvincular' ($stillExists.success -eq $true)

# 16. Usuario 2 + receta general
$u2 = Call 'POST' '/auth/register' @{ name='Ana'; email='ana@test.com'; password='123456' } $null
$t2 = $u2.data.token
$r3 = Call 'POST' '/recipes' @{ title='Ensalada'; steps=@('Cortar','Servir') } $t2
$general = Call 'GET' '/recipes' $null $t1
Check 'Vista general: recetas de ambos usuarios' ($general.data.Count -eq 3)
$mine1 = Call 'GET' '/recipes?mine=true' $null $t2
Check 'Personales de Ana: solo 1' ($mine1.data.Count -eq 1)

# 17. Borrar grupo con cascada (receta propia se elimina)
$delG = Call 'DELETE' "/groups/$g1id" $null $t1
Check 'Borrar grupo: 1 receta eliminada, 0 desvinculada' (($delG.data.deletedRecipes -eq 1) -and ($delG.data.detachedRecipes -eq 0))
$afterDel = Call 'GET' "/recipes/$($r1.data._id)" $null $t1
Check 'Receta del grupo borrado ya no existe (404)' ($afterDel.status -eq 404)

# 18. Borrar receta
$delR = Call 'DELETE' "/recipes/$($r3.data._id)" $null $t2
Check 'Borrar receta' ($delR.success -eq $true)

# 19. Borrar cuenta
$delU = Call 'DELETE' '/users/me' $null $t2
Check 'Borrar cuenta usuario 2' ($delU.success -eq $true)
$loginDeleted = Call 'POST' '/auth/login' @{ email='ana@test.com'; password='123456' } $null
Check 'Login de cuenta borrada rechazado' ($loginDeleted.status -eq 401)

Write-Host "`n================ RESULTADOS ================"
$results | ForEach-Object { "{0,-45} {1}" -f $_.Test, $(if ($_.OK) { 'PASS' } else { 'FAIL' }) }
$passed = ($results | Where-Object { $_.OK }).Count
$total = $results.Count
Write-Host "`nTotal: $passed/$total pruebas superadas"
