/**
 * 🕵️ Módulo para testar vulnerabilidades de Open Redirect em URLs
 * @module OpenRedirectTester
 * @requires axios
 * @requires fs
 * @requires path
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * 🎨 Códigos de cores ANSI para formatação no terminal
 * @namespace textColors
 */
const textColors = {
  yellow: '\x1b[33m',  // 🌕 Amarelo
  cyan: '\x1b[36m',    // 💧 Ciano
  green: '\x1b[32m',   // 🍀 Verde
  red: '\x1b[31m',     // ❤️ Vermelho
  reset: '\x1b[0m',    // 🔄 Resetar
};

/**
 * ⚙️ Configurações globais do teste
 * @typedef {Object} TestConfig
 * @property {string} baseUrl - 🎯 URL alvo
 * @property {string[]} targetUrls - 🌍 URLs de destino
 * @property {string[]} testParams - 🛡️ Parâmetros testados
 * @property {number} delayBetweenRequests - ⏳ Delay entre requests (ms)
 * @property {number} maxRetries - 🔄 Máximo de retentativas
 * @property {string} userAgent - 🤖 User-Agent das requisições
 */

/**
 * @type {TestConfig}
 */
const TEST_CONFIG = {
  baseUrl: '', // 📁 Será carregado de target/alvo.txt
  targetUrls: [], // 📂 Será carregado de target/destinos.txt
  testParams: [], // 📜 Será carregado de target/params.txt
  delayBetweenRequests: 1000, // ⏱️ 1 segundo
  maxRetries: 3, // ♻️ 3 tentativas
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * 📊 Resultados acumulados dos testes
 * @typedef {Object} TestResults
 * @property {number} totalDetected - ✅ Vulnerabilidades encontradas
 * @property {number} testedUrls - 🔄 URLs testadas
 * @property {number} failedRequests - ❌ Requisições falhas
 * @property {string[]} reportContent - 📝 Conteúdo do relatório
 */

/**
 * @type {TestResults}
 */
const TEST_RESULTS = {
  totalDetected: 0,
  testedUrls: 0,
  failedRequests: 0,
  reportContent: []
};

/**
 * 📥 Carrega configurações dos arquivos na pasta target
 * @async
 * @function loadConfigFromFiles
 * @throws {Error} Se arquivos não existirem ou estiverem vazios
 */
async function loadConfigFromFiles() {
  try {
    // 1️⃣ Carrega URL alvo
    const baseUrlPath = path.join(__dirname, '../target/alvo.txt');
    TEST_CONFIG.baseUrl = (await fs.promises.readFile(baseUrlPath, 'utf-8')).trim();

    if (!TEST_CONFIG.baseUrl) throw new Error('📭 Arquivo alvo.txt vazio');

    // 2️⃣ Carrega URLs de destino (ignorando comentários e linhas vazias)
    const destinosPath = path.join(__dirname, '../target/destinos.txt');
    TEST_CONFIG.targetUrls = (await fs.promises.readFile(destinosPath, 'utf-8'))
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // ⚠️ Filtra comentários e linhas vazias

    if (TEST_CONFIG.targetUrls.length === 0) {
      throw new Error('📭 Nenhum destino válido em destinos.txt (após filtrar comentários)');
    }
  } catch (error) {
    console.error(`${textColors.red}❌ Erro: ${error.message}${textColors.reset}`);
    process.exit(1);
  }
}

/**
 * 🔤 Codifica URL substituindo pontos por %2E
 * @function encodeUrlWithDots
 * @param {string} url - 🌐 URL original
 * @returns {string} 🔗 URL codificada
 */
function encodeUrlWithDots(url) {
  return encodeURIComponent(url)
    .replace(/\./g, '%2E')  // 🔄 Substitui pontos
    .replace(/%20/g, '+');  // 🔄 Substitui espaços
}

/**
 * 📖 Carrega wordlist de parâmetros
 * @async
 * @function loadWordlist
 * @param {string} filePath - 📂 Caminho do arquivo
 * @returns {Promise<string[]>} 🛡️ Lista de parâmetros
 */
async function loadWordlist(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(Boolean);
  } catch (error) {
    console.error(`${textColors.red}❌ Falha ao carregar wordlist: ${error.message}${textColors.reset}`);
    process.exit(1);
  }
}

/**
 * 💤 Cria uma pausa assíncrona
 * @function sleep
 * @param {number} ms - ⏳ Milissegundos
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ⏰ Calcula tempo estimado de execução
 * @function calculateEstimatedTime
 * @param {number} totalRequests - 🔢 Total de requisições
 * @param {number} delay - ⏳ Delay entre requisições
 * @returns {string} 🕒 Tempo formatado
 */
function calculateEstimatedTime(totalRequests, delay) {
  const totalTimeMs = totalRequests * delay;
  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);
  return `${minutes > 0 ? `${minutes}min ` : ''}${seconds}s`;
}

/**
 * 🧪 Testa um parâmetro para open redirect
 * @async
 * @function testRedirectParameter
 * @param {string} param - 🛡️ Parâmetro testado
 * @param {string} targetUrl - 🌍 URL de destino
 * @param {boolean} [encoded=false] - 🔤 URL codificada?
 */
async function testRedirectParameter(param, targetUrl, encoded = false) {
  const testUrl = `${TEST_CONFIG.baseUrl}?${param}=${encoded ? encodeUrlWithDots(targetUrl) : targetUrl
    }`;
  TEST_RESULTS.testedUrls++;

  let retries = TEST_CONFIG.maxRetries;
  while (retries > 0) {
    try {
      const response = await axios.get(testUrl, {
        maxRedirects: 0, // 🚫 Sem redirecionamento
        validateStatus: status => status >= 200 && status < 400,
        headers: { 'User-Agent': TEST_CONFIG.userAgent }
      });

      // 🔍 Detecta redirecionamento (status 3xx)
      if (response.status >= 300 && response.status < 400) {
        const decodedLocation = decodeURIComponent(response.headers.location);

        if (decodedLocation === targetUrl) {
          const destinationResponse = await axios.get(decodedLocation, {
            validateStatus: status => status === 200
          });

          if (destinationResponse.status === 200) {
            // 🎨 Exibe resultado colorido
            console.log([
              `${textColors.yellow}⚠️ VULNERÁVEL: ${param}${encoded ? ' (encoded)' : ''}`,
              `🔗 Testado em: ${testUrl}`,
              `📍 Redireciona para: ${decodedLocation}\n`
            ].join('\n'));

            // 📝 Adiciona ao relatório
            TEST_RESULTS.reportContent.push(
              `⚠️ VULNERÁVEL: ${param}${encoded ? ' (encoded)' : ''}`,
              `🔗 Testado em: ${testUrl}`,
              `📍 Redireciona para: ${decodedLocation}\n`
            );

            TEST_RESULTS.totalDetected++;
          }
        }
      }
      break;
    } catch (error) {
      retries--;
      if (retries === 0) TEST_RESULTS.failedRequests++;
      await sleep(TEST_CONFIG.delayBetweenRequests);
    }
  }
}

/**
 * 📝 Gera relatório final
 * @async
 * @function generateReport
 * @returns {Promise<string>} 📄 Conteúdo do relatório
 */
async function generateReport() {
  const report = [
    '🔎 RELATÓRIO - Open Redirect Test',
    `⏰ ${new Date().toLocaleString()}`,
    '--------------------------------',
    `🛡️ Parâmetros: ${TEST_CONFIG.testParams.length}`,
    `🎯 Alvo: ${TEST_CONFIG.baseUrl}`,
    `🌐 Destinos: ${TEST_CONFIG.targetUrls.join(', ')}`,
    '--------------------------------\n',
  ];

  // 📌 Adiciona resultados
  report.push(...(
    TEST_RESULTS.reportContent.length > 0
      ? TEST_RESULTS.reportContent
      : ['🟢 Nenhuma vulnerabilidade encontrada!\n']
  ));

  // 📊 Adiciona estatísticas
  report.push(
    '\n📊 ESTATÍSTICAS:',
    `🔢 URLs testadas: ${TEST_RESULTS.testedUrls}`,
    `✅ Vulnerabilidades: ${TEST_RESULTS.totalDetected}`,
    `❌ Falhas: ${TEST_RESULTS.failedRequests}\n`,
    TEST_RESULTS.totalDetected > 0
      ? '⚠️  Ação necessária!'
      : '✅ Sistema seguro!'
  );

  return report.join('\n');
}

/**
 * 🚀 Função principal que executa os testes
 * @async
 * @function runSecurityTests
 */
async function runSecurityTests() {
  // 1️⃣ Inicialização
  console.log(`${textColors.cyan}
🛡️  INICIANDO TESTE DE OPEN REDIRECT
================================`);

  await loadConfigFromFiles();
  TEST_CONFIG.testParams = await loadWordlist(path.join(__dirname, '../target/params.txt'));

  // 2️⃣ Exibe configuração
  const totalRequests = TEST_CONFIG.testParams.length * TEST_CONFIG.targetUrls.length * 2;
  console.log(`
🎯 ALVO: ${TEST_CONFIG.baseUrl}
🌐 DESTINOS: ${TEST_CONFIG.targetUrls.length}
🛡️ PARÂMETROS: ${TEST_CONFIG.testParams.length}
⏳ TEMPO ESTIMADO: ${calculateEstimatedTime(totalRequests, TEST_CONFIG.delayBetweenRequests)}
`);

  // 3️⃣ Execução dos testes
  console.log(`\n🔍 EXECUTANDO TESTES...\n${textColors.reset}`);

  for (const param of TEST_CONFIG.testParams) {
    await Promise.all(TEST_CONFIG.targetUrls.map(async (targetUrl) => {
      await testRedirectParameter(param, targetUrl, false);
      await sleep(TEST_CONFIG.delayBetweenRequests);
      await testRedirectParameter(param, targetUrl, true);
      await sleep(TEST_CONFIG.delayBetweenRequests);
    }));
  }

  // 4️⃣ Resultados finais
  console.log(`${textColors.green}
📊 RESULTADOS:
✅ ${TEST_RESULTS.totalDetected} vulnerabilidades
🔢 ${TEST_RESULTS.testedUrls} URLs testadas
❌ ${TEST_RESULTS.failedRequests} falhas
${textColors.reset}`);

  // 5️⃣ Gera relatório
  fs.writeFileSync(
    path.join(__dirname, 'report.txt'),
    await generateReport(),
    'utf-8'
  );
  console.log(`${textColors.cyan}📄 Relatório salvo em: ${path.resolve(__dirname, 'report.txt')}${textColors.reset}`);
}

// ⚡ Ponto de entrada
runSecurityTests().catch(error => {
  console.error(`${textColors.red}⛔ ERRO CRÍTICO: ${error.message}${textColors.reset}`);
  process.exit(1);
});