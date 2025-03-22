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
  targetUrls: ['http://google.com', 'https://google.com', 'google.com'], // Lista de URLs alvo
  testParams: [], // Inicialmente vazio, será preenchido com a wordlist
  delayBetweenRequests: 1000, // Delay de 1 segundo entre requisições
  maxRetries: 3, // Número máximo de tentativas em caso de erro
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' // User-Agent personalizado
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
 * 🕒 Aguarda um tempo específico
 * @param {number} ms - Tempo em milissegundos
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🧪 Verifica se a URL final após o redirecionamento corresponde ao destino esperado
 * @param {string} url - URL para seguir redirecionamentos
 * @param {string} targetUrl - URL alvo esperada
 * @returns {Promise<boolean>} - Retorna `true` se o redirecionamento final for para o destino esperado
 */
async function isFinalRedirectToTarget(url, targetUrl) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 10, // Segue até 10 redirecionamentos
      validateStatus: () => true, // Aceita todos os status codes
      headers: {
        'User-Agent': TEST_CONFIG.userAgent // Adiciona um User-Agent personalizado
      }
    });

    // Verifica se a URL final corresponde ao destino esperado
    const finalUrl = response.request.res.responseUrl || response.config.url;
    return finalUrl.includes(targetUrl);
  } catch (error) {
    return false; // Ignora erros de requisição
  }
}

/**
 * 🧪 Executa um teste de redirecionamento para um parâmetro específico
 * @param {string} param - Parâmetro de query a ser testado
 * @param {boolean} [encoded=false] - Deve usar URL codificada?
 * @param {string} targetUrl - URL alvo para redirecionamento
 * @param {number} retryCount - Número de tentativas restantes
 * @returns {Promise<void>}
 */
async function testRedirectParameter(param, encoded = false, targetUrl, retryCount = TEST_CONFIG.maxRetries) {
  const encodedUrl = encoded 
    ? encodeURIComponent(targetUrl)
    : targetUrl;

  const testUrl = `${TEST_CONFIG.baseUrl}?${param}=${encodedUrl}`;
  TEST_RESULTS.testedUrls++;

  try {
    const response = await axios.get(testUrl, {
      maxRedirects: 0, // Impede seguimento automático de redirecionamentos
      validateStatus: status => status >= 200 && status < 400,
      headers: {
        'User-Agent': TEST_CONFIG.userAgent // Adiciona um User-Agent personalizado
      }
    });

    // 🔍 Verifica se é um redirecionamento válido (3xx)
    if (response.status >= 300) {
      const isFinalRedirectValid = await isFinalRedirectToTarget(testUrl, targetUrl);

      if (isFinalRedirectValid) {
        console.log([
          `${textColors.yellow}🟢 Redirecionamento VULNERÁVEL detectado!`,
          `📌 Parâmetro: ${textColors.magenta}${param}${encoded ? ' (encoded)' : ''}`,
          `📍 Destino: ${textColors.cyan}${targetUrl}`,
          `🔗 URL Testada: ${textColors.cyan}${TEST_CONFIG.baseUrl}?${param}=${encoded ? encodeURIComponent(targetUrl) : targetUrl}${textColors.reset}`
        ].join('\n') + '\n');
        
        TEST_RESULTS.totalDetected++;
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 429) {
      // Erro 429: Too Many Requests (Rate Limit)
      console.log(`${textColors.red}⚠️  Rate limit atingido. Aguardando antes de tentar novamente...${textColors.reset}`);
      await sleep(5000); // Aguarda 5 segundos antes de tentar novamente
      if (retryCount > 0) {
        await testRedirectParameter(param, encoded, targetUrl, retryCount - 1); // Tenta novamente
      } else {
        console.log(`${textColors.red}❌ Número máximo de tentativas atingido para: ${testUrl}${textColors.reset}`);
      }
    } else {
      // Outros erros são ignorados
    }
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
🌐 URLs Alvo: ${TEST_CONFIG.targetUrls.join(', ')}
⏳ Aguarde...${textColors.reset}\n`);

  // Executa testes sequenciais para cada URL alvo
  for (const targetUrl of TEST_CONFIG.targetUrls) {
    for (const param of TEST_CONFIG.testParams) {
      await testRedirectParameter(param, false, targetUrl); // Versão não codificada
      await testRedirectParameter(param, true, targetUrl);  // Versão codificada
      await sleep(TEST_CONFIG.delayBetweenRequests); // Aguarda entre requisições
    }
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