<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET');
header('Access-Control-Allow-Headers: Content-Type');

class NetflixValidator {
    
    public function validate($cookieContent) {
        $cookies = $this->parseCookies($cookieContent);
        
        if (!$cookies) {
            return [
                'success' => false,
                'error' => 'No se encontraron cookies válidas de Netflix',
                'estado' => 'INVALIDA'
            ];
        }
        
        return $this->checkNetflix($cookies);
    }
    
    private function parseCookies($content) {
        $cookies = [];
        $lines = explode("\n", $content);
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || $line[0] === '#') continue;
            
            // Formato Netscape (con tabs)
            if (strpos($line, "\t") !== false) {
                $parts = explode("\t", $line);
                if (count($parts) >= 7) {
                    $name = $parts[5];
                    $value = $parts[6];
                    if (!empty($name) && $value !== '') {
                        $cookies[$name] = $value; // Guardar como string simple
                    }
                }
            } 
            // Formato simple
            elseif (strpos($line, '=') !== false) {
                if (strpos($line, ';') !== false) {
                    $line = explode(';', $line)[0];
                }
                $parts = explode('=', $line, 2);
                $name = trim($parts[0]);
                $value = trim($parts[1]);
                if (!empty($name) && $value !== '') {
                    $cookies[$name] = $value;
                }
            }
        }
        
        return !empty($cookies) ? $cookies : null;
    }
    
    private function checkNetflix($cookies) {
        // Construir cookie string para la petición
        $cookieString = '';
        foreach ($cookies as $name => $value) {
            $cookieString .= "$name=$value; ";
        }
        
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER => [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language: es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
                'Cookie: ' . $cookieString
            ]
        ]);
        
        // Primera petición
        curl_setopt($ch, CURLOPT_URL, 'https://www.netflix.com');
        $response = curl_exec($ch);
        $info = curl_getinfo($ch);
        
        if ($info['http_code'] == 302 && strpos($info['redirect_url'] ?? '', 'login') !== false) {
            curl_close($ch);
            return [
                'success' => false,
                'estado' => 'INVALIDA',
                'mensaje' => 'Cookie inválida - Redirige a login'
            ];
        }
        
        // Segunda petición
        curl_setopt($ch, CURLOPT_URL, 'https://www.netflix.com/account');
        $html = curl_exec($ch);
        $info = curl_getinfo($ch);
        
        curl_close($ch);
        
        if (strpos($info['url'] ?? '', 'login') !== false) {
            return [
                'success' => false,
                'estado' => 'INVALIDA',
                'mensaje' => 'Cookie inválida'
            ];
        }
        
        $email = $this->extractEmail($html);
        $plan = $this->extractPlan($html);
        $country = $this->extractCountry($html);
        $membership = $this->extractMembership($html);
        $profiles = $this->extractProfiles($html);
        
        if (strpos($html, '"CURRENT_MEMBER":true') !== false) {
            return [
                'success' => true,
                'estado' => 'ACTIVA',
                'email' => $email,
                'plan' => $plan,
                'pais' => $country,
                'membresia' => $membership,
                'perfiles' => $profiles,
                'cookies' => $cookies  // Enviar cookies como array simple
            ];
        } else {
            return [
                'success' => false,
                'estado' => 'INACTIVA',
                'email' => $email,
                'plan' => $plan,
                'pais' => $country,
                'mensaje' => 'Cuenta inactiva'
            ];
        }
    }
    
    private function extractEmail($html) {
        if (preg_match('/"emailAddress":"([^"]+)"/', $html, $matches)) {
            return str_replace(['&amp;', '\\u0040'], ['@', '@'], $matches[1]);
        }
        return 'No encontrado';
    }
    
    private function extractPlan($html) {
        if (preg_match('/"planName":"([^"]+)"/', $html, $matches)) {
            return $matches[1];
        }
        $planes = ['Premium', 'Básico', 'Estándar', 'Standard', 'Basic'];
        foreach ($planes as $plan) {
            if (stripos($html, $plan) !== false) {
                return $plan;
            }
        }
        return 'N/A';
    }
    
    private function extractCountry($html) {
        if (preg_match('/"countryOfSignup":"([^"]+)"/', $html, $matches)) {
            return $matches[1];
        }
        return 'N/A';
    }
    
    private function extractMembership($html) {
        if (preg_match('/account-overview-page\+membership-card\+description">([^<]+)</', $html, $matches)) {
            return trim($matches[1]);
        }
        return 'N/A';
    }
    
    private function extractProfiles($html) {
        if (preg_match_all('/"firstName":"([^"]+)"/', $html, $matches)) {
            return implode(', ', $matches[1]);
        }
        return '1 perfil';
    }
}

// Manejar descarga de cookies en formato Netscape
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['download'])) {
    $data = json_decode(base64_decode($_GET['download']), true);
    
    if ($data && isset($data['email'])) {
        $filename = $data['email'] . '_' . $data['plan'] . '_cookies.txt';
        $filename = preg_replace('/[^a-zA-Z0-9_]/', '_', $filename);
        
        // Construir contenido en formato Netscape
        $content = "# Netscape HTTP Cookie File\n";
        $content .= "# https://curl.se/docs/http-cookies.html\n";
        $content .= "# Generated: " . date('Y-m-d H:i:s') . "\n";
        $content .= "# Email: {$data['email']}\n";
        $content .= "# Plan: {$data['plan']}\n";
        $content .= "# Country: {$data['pais']}\n";
        $content .= "# Membership: {$data['membresia']}\n";
        $content .= "# ========================================\n\n";
        
        // Escribir cada cookie en formato Netscape
        foreach ($data['cookies'] as $name => $value) {
            // Escapar valores especiales
            $value = str_replace(["\n", "\r"], '', $value);
            $domain = '.netflix.com';
            $flag = 'TRUE';
            $path = '/';
            $secure = 'TRUE';
            $expiration = time() + 31536000; // 1 año
            
            $content .= "$domain\t$flag\t$path\t$secure\t$expiration\t$name\t$value\n";
        }
        
        header('Content-Type: text/plain');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($content));
        echo $content;
        exit;
    }
}

// Manejar petición de validación
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['cookies']) || empty($input['cookies'])) {
        echo json_encode([
            'success' => false, 
            'error' => 'No se proporcionaron cookies',
            'estado' => 'ERROR'
        ]);
        exit;
    }
    
    $validator = new NetflixValidator();
    $result = $validator->validate($input['cookies']);
    
    echo json_encode($result);
    exit;
}

echo json_encode(['error' => 'Método no permitido']);
?>