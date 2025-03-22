const axios = require('axios');
const fs = require('fs');
const path = require('path');

/* 🌈 Cores ANSI para formatação no terminal */
const textColors = {
  yellow: '\x1b[33m',    // Cores de alerta
  cyan: '\x1b[36m',      // Cores de informação
  green: '\x1b[32m',     // Cores de sucesso
  red: '\x1b[31m',       // Cores de erro
  magenta: '\x1b[35m',   // Cores de destaque
  reset: '\x1b[0m',      // Resetar formatação
};

/* 🌐 Configurações principais */
const TEST_CONFIG = {
  baseUrl: 'https://exemplo.com',
  targetUrl: 'https://google.com',
  testParams: [] // Inicialmente vazio, será preenchido com a wordlist
};

/* 📊 Resultados dos testes */
const TEST_RESULTS = {
  totalDetected: 0,
  testedUrls: 0
};

/**
 * 📖 Carrega a wordlist de um arquivo .txt
 * @param {string} filePath - Caminho do arquivo .txt
 * @returns {Promise<string[]>} - Lista de parâmetros
 */
async function loadWordlist(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (error) {
    console.error(`${textColors.red}❌ Erro ao carregar a wordlist: ${error.message}${textColors.reset}`);
    process.exit(1);
  }
}

/**
 * 🧪 Executa um teste de redirecionamento para um parâmetro específico
 * @param {string} param - Parâmetro de query a ser testado
 * @param {boolean} [encoded=false] - Deve usar URL codificada?
 * @returns {Promise<void>}
 */
async function testRedirectParameter(param, encoded = false) {
  const encodedUrl = encoded 
    ? encodeURIComponent(TEST_CONFIG.targetUrl)
    : TEST_CONFIG.targetUrl;

  const testUrl = `${TEST_CONFIG.baseUrl}?${param}=${encodedUrl}`;
  TEST_RESULTS.testedUrls++;

  try {
    const response = await axios.get(testUrl, {
      maxRedirects: 0, // Impede seguimento automático de redirecionamentos
      validateStatus: status => status >= 200 && status < 400
    });

    // 🔍 Verifica se é um redirecionamento válido (3xx)
    if (response.status >= 300) {
      const isExactMatch = response.headers.location === TEST_CONFIG.targetUrl;
      
      if (isExactMatch) {
        console.log([
          `${textColors.yellow}🟢 Redirecionamento VULNERÁVEL detectado!`,
          `📌 Parâmetro: ${textColors.magenta}${param}${encoded ? ' (encoded)' : ''}`,
          `📍 Destino: ${textColors.cyan}${response.headers.location}`,
          `🔗 URL Testada: ${textColors.cyan}${testUrl}${textColors.reset}`
        ].join('\n') + '\n');
        
        TEST_RESULTS.totalDetected++;
      }
    }
  } catch (error) {
    // Ignora erros de requisição intencionais
  }
}

/**
 * 🚀 Executa a suíte de testes completa
 * @returns {Promise<void>}
 */
async function runSecurityTests() {
  // Carrega a wordlist
  const wordlistPath = path.join(__dirname, 'params.txt'); // Ajuste o caminho conforme necessário
  TEST_CONFIG.testParams = await loadWordlist(wordlistPath);

  console.log(`${textColors.cyan}
🔎 Iniciando teste de Open Redirect
🛡️  Parâmetros testados: ${TEST_CONFIG.testParams.length}
🌐 URL Alvo: ${TEST_CONFIG.targetUrl}
⏳ Aguarde...${textColors.reset}\n`);

  // Executa testes sequenciais
  for (const param of TEST_CONFIG.testParams) {
    await testRedirectParameter(param, false); // Versão não codificada
    await testRedirectParameter(param, true);  // Versão codificada
  }

  // 🎯 Resultado final
  console.log(`${textColors.green}
📊 Relatório Final:
🔄 URLs testadas: ${TEST_RESULTS.testedUrls}
✅ Redirecionamentos detectados: ${TEST_RESULTS.totalDetected}${textColors.reset}`);

  // Exibe alerta se nenhuma vulnerabilidade foi encontrada
  if (TEST_RESULTS.totalDetected === 0) {
    console.log(`\n${textColors.red}🔴 Nenhuma vulnerabilidade de open redirect encontrada!${textColors.reset}`);
  } else {
    console.log(`${textColors.yellow}\n⚠️  Atenção: Vulnerabilidades requerem correção imediata!${textColors.reset}`);
  }
}

// ⚡ Inicia a execução dos testes
runSecurityTests();