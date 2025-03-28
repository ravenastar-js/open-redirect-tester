/**
 * 🕵️ Módulo otimizado para testar vulnerabilidades de Open Redirect em URLs
 * @module OpenRedirectTester
 * @requires axios
 * @requires fs
 * @requires path
 * @requires url
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

/**
 * 🌈 Códigos de cores ANSI para terminal
 * @type {Object}
 */
const textColors = {
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

/**
 * ⚙️ Configurações do teste
 * @type {Object}
 */
const TEST_CONFIG = {
  baseUrl: '',
  targetUrls: [],
  testParams: [],
  delayBetweenRequests: 1000,
  maxRetries: 3,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
  ]
};

/**
 * 📊 Resultados dos testes
 * @type {Object}
 */
const TEST_RESULTS = {
  totalDetected: 0,
  testedUrls: 0,
  failedRequests: 0,
  reportContent: []
};

/**
 * 🎲 Retorna um User-Agent aleatório
 * @function getRandomUserAgent
 * @returns {string} 📱 User-Agent aleatório
 */
function getRandomUserAgent() {
  return TEST_CONFIG.userAgents[Math.floor(Math.random() * TEST_CONFIG.userAgents.length)];
}

/**
 * ⏳ Pausa a execução por um tempo determinado
 * @function sleep
 * @param {number} ms - Milissegundos para pausar
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🌍 Verifica se um redirecionamento é externo
 * @function isExternalRedirect
 * @param {string} baseUrl - URL base
 * @param {string} redirectUrl - URL de redirecionamento
 * @returns {boolean}
 */
function isExternalRedirect(baseUrl, redirectUrl) {
  try {
    if (!redirectUrl.startsWith('http')) return false;
    const baseHost = new URL(baseUrl).hostname.replace('www.', '');
    const redirectHost = new URL(redirectUrl).hostname.replace('www.', '');
    return baseHost !== redirectHost;
  } catch {
    return false;
  }
}

/**
 * 📂 Carrega configurações dos arquivos
 * @async
 * @function loadConfigFromFiles
 * @throws {Error} Se os arquivos estiverem vazios ou inválidos
 */
async function loadConfigFromFiles() {
  const baseUrlPath = path.join(__dirname, '../target/alvo.txt');
  TEST_CONFIG.baseUrl = (await fs.readFile(baseUrlPath, 'utf-8')).trim();
  if (!TEST_CONFIG.baseUrl) throw new Error('Arquivo alvo.txt vazio');

  const payloadsPath = path.join(__dirname, '../target/payloads.txt');
  TEST_CONFIG.targetUrls = (await fs.readFile(payloadsPath, 'utf-8'))
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !/^#{3,}/.test(line));

  if (TEST_CONFIG.targetUrls.length === 0) {
    throw new Error('Nenhum payload válido encontrado em payloads.txt');
  }
}

/**
 * 📖 Carrega uma wordlist de arquivo
 * @async
 * @function loadWordlist
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<string[]>} Lista de parâmetros
 */
async function loadWordlist(filePath) {
  const data = await fs.readFile(filePath, 'utf-8');
  return data.split('\n').map(line => line.trim()).filter(Boolean);
}

/**
 * 🎯 Validador Rigoroso de Open Redirect
 * @function isValidRedirect
 * @param {string} redirectUrl - URL de redirecionamento
 * @param {string} finalUrl - URL final após redirecionamento
 * @returns {boolean}
 */
function isValidRedirect(redirectUrl, finalUrl) {
  try {
    const normalize = (url) => {
      return url.replace(/^(https?:\/\/)?(www\.)?/, '')
        .split(/[\/?#]/)[0]
        .toLowerCase();
    };
    return normalize(redirectUrl) === normalize(finalUrl);
  } catch {
    return false;
  }
}

/**
 * 🧪 Testa um parâmetro de redirecionamento
 * @async
 * @function testRedirectParameter
 * @param {string} param - Parâmetro testado
 * @param {string} targetUrl - URL de destino
 */
async function testRedirectParameter(param, targetUrl) {
  const testUrl = `${TEST_CONFIG.baseUrl}?${param}=${targetUrl}`;
  TEST_RESULTS.testedUrls++;

  for (let retry = 0; retry < TEST_CONFIG.maxRetries; retry++) {
    try {
      const response = await axios.get(testUrl, {
        maxRedirects: 0,
        timeout: 10000,
        validateStatus: null,
        headers: { 'User-Agent': getRandomUserAgent() }
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.location || '';
        const decodedLocation = decodeURIComponent(location);

        const confirmResponse = await axios.get(testUrl, {
          maxRedirects: 5,
          timeout: 10000,
          validateStatus: null
        });

        const finalUrl = confirmResponse.request.res.responseUrl;

        if (finalUrl && (isValidRedirect(decodedLocation, finalUrl) || isExternalRedirect(TEST_CONFIG.baseUrl, finalUrl))) {
          const coloredResult = [
            `${textColors.yellow}⚠️ VULNERÁVEL: ${param}${textColors.reset}`,
            `${textColors.cyan}🔗 Testado em: ${testUrl}${textColors.reset}`,
            `${textColors.green}📍 Redireciona para: ${decodedLocation}${textColors.reset}`,
            `${textColors.green}🌍 Destino final: ${finalUrl}${textColors.reset}`,
            `${textColors.cyan}📊 Status: ${response.status}\n${textColors.reset}`
          ].join('\n');

          TEST_RESULTS.reportContent.push(coloredResult.replace(/\x1b\[\d+m/g, ''));
          TEST_RESULTS.totalDetected++;
          console.log(coloredResult);
        }
      }
      break;
    } catch (error) {
      if (retry === TEST_CONFIG.maxRetries - 1) {
        TEST_RESULTS.failedRequests++;
        console.error(`${textColors.red}❌ Falha ao testar ${testUrl}${textColors.reset}`);
      }
      await sleep(TEST_CONFIG.delayBetweenRequests);
    }
  }
}

/**
 * 📝 Gera relatório final
 * @async
 * @function generateReport
 * @returns {Promise<string>} 📄 Conteúdo do relatório formatado
 */
async function generateReport() {
  const report = [
    '🔎 RELATÓRIO - Open Redirect Test',
    `⏰ ${new Date().toLocaleString()}`,
    '--------------------------------',
    `🎯 Alvo: ${TEST_CONFIG.baseUrl}`,
    `🛡️ Parâmetros: ${TEST_CONFIG.testParams.join(', ')}`,
    `🌐 Total de payloads: ${TEST_CONFIG.targetUrls.length}`,
    '--------------------------------\n',
    ...(TEST_RESULTS.reportContent.length > 0 ?
      TEST_RESULTS.reportContent :
      ['🟢 Nenhuma vulnerabilidade encontrada!\n']
    ),
    '\n📊 ESTATÍSTICAS:',
    `🔢 URLs testadas: ${TEST_RESULTS.testedUrls}`,
    `✅ Vulnerabilidades: ${TEST_RESULTS.totalDetected}`,
    `❌ Falhas: ${TEST_RESULTS.failedRequests}`,
    '\n' + (TEST_RESULTS.totalDetected > 0 ?
      '⚠️ Ação necessária!' :
      '✅ Sistema seguro!')
  ];

  return report.join('\n');
}

/**
 * 🚀 Executa todos os testes de segurança
 * @async
 * @function runSecurityTests
 */
async function runSecurityTests() {
  console.log(`${textColors.cyan}🛡️  INICIANDO TESTE DE OPEN REDIRECT\n================================`);

  await loadConfigFromFiles();
  TEST_CONFIG.testParams = await loadWordlist(path.join(__dirname, '../target/params.txt'));

  console.log(`\n🎯 ALVO: ${TEST_CONFIG.baseUrl}\n🌐 PAYLOADS: ${TEST_CONFIG.targetUrls.length}\n🛡️ PARÂMETROS: ${TEST_CONFIG.testParams.length}\n`);
  console.log(`${textColors.cyan}🔍 EXECUTANDO TESTES...\n${textColors.reset}`);

  const startTime = Date.now();

  for (const param of TEST_CONFIG.testParams) {
    for (const targetUrl of TEST_CONFIG.targetUrls) {
      await testRedirectParameter(param, targetUrl);
      await sleep(TEST_CONFIG.delayBetweenRequests);
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`${textColors.green}\n📊 RESULTADOS:\n✅ ${TEST_RESULTS.totalDetected} vulnerabilidades\n🔢 ${TEST_RESULTS.testedUrls} URLs testadas\n❌ ${TEST_RESULTS.failedRequests} falhas\n⏱️ Tempo total: ${elapsedTime}s${textColors.reset}`);

  const reportPath = path.join(__dirname, 'report.txt');
  await fs.writeFile(reportPath, await generateReport(), 'utf-8');
  console.log(`${textColors.cyan}📄 Relatório salvo em: ${path.resolve(reportPath)}${textColors.reset}`);
}

runSecurityTests().catch(error => {
  console.error(`${textColors.red}⛔ ERRO: ${error.message}${textColors.reset}`);
  process.exit(1);
});