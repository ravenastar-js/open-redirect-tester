const axios = require('axios');
const fs = require('fs');
const path = require('path');

/* 🌈 Cores ANSI para formatação no terminal */
const textColors = {
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

/* 🌐 Configurações principais */
const TEST_CONFIG = {
  baseUrl: 'https://exemplo.com',
  targetUrls: ['http://google.com', 'https://google.com', 'google.com'],
  testParams: [],
  delayBetweenRequests: 1000,
  maxRetries: 3,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/* 📊 Resultados e relatório */
const TEST_RESULTS = {
  totalDetected: 0,
  testedUrls: 0,
  failedRequests: 0,
  reportContent: []
};

function encodeUrlWithDots(url) {
  return encodeURIComponent(url)
    .replace(/\./g, '%2E')
    .replace(/%20/g, '+');
}

async function loadWordlist(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (error) {
    console.error(`${textColors.red}❌ Erro ao carregar a wordlist: ${error.message}${textColors.reset}`);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateEstimatedTime(totalRequests, delay) {
  const totalTimeMs = totalRequests * delay;
  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);
  return `${minutes > 0 ? `${minutes}min ` : ''}${seconds}s`;
}

async function testRedirectParameter(param, targetUrl, encoded = false) {
  const encodedUrl = encoded ? encodeUrlWithDots(targetUrl) : targetUrl;
  const testUrl = `${TEST_CONFIG.baseUrl}?${param}=${encodedUrl}`;
  TEST_RESULTS.testedUrls++;

  let retries = TEST_CONFIG.maxRetries;
  while (retries > 0) {
    try {
      const response = await axios.get(testUrl, {
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400,
        headers: {
          'User-Agent': TEST_CONFIG.userAgent,
          'Accept-Encoding': 'gzip, deflate'
        }
      });

      if (response.status >= 300 && response.status < 400) {
        const decodedLocation = decodeURIComponent(response.headers.location);
        const isExactMatch = decodedLocation === targetUrl;

        if (isExactMatch) {
          // Verifica se a URL de destino retorna 200 OK
          const destinationResponse = await axios.get(decodedLocation, {
            validateStatus: status => status === 200,
            headers: {
              'User-Agent': TEST_CONFIG.userAgent,
              'Accept-Encoding': 'gzip, deflate'
            }
          });

          if (destinationResponse.status === 200) {
            // Mensagem colorida para o terminal
            console.log([
              `${textColors.yellow}🟢 Redirecionamento VULNERÁVEL detectado!${textColors.reset}`,
              `📌 ${textColors.magenta}Parâmetro: ${param}${encoded ? ' (encoded)' : ''}${textColors.reset}`,
              `📍 ${textColors.cyan}Destino: ${decodedLocation}${textColors.reset}`,
              `🔗 ${textColors.cyan}URL Testada: ${testUrl}${textColors.reset}\n`
            ].join('\n'));

            // Versão sem cores para o relatório
            TEST_RESULTS.reportContent.push(
              `🟢 VULNERABILIDADE: ${param}${encoded ? ' (encoded)' : ''}`,
              `📍 Destino: ${decodedLocation}`,
              `🔗 Testado em: ${testUrl}\n`
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

async function generateReport() {
  const report = [
    '🔎 Teste de Open Redirect - Relatório Final',
    `⏰ Data: ${new Date().toLocaleString()}`,
    '-----------------------------------------------',
    `🛡️ Parâmetros testados: ${TEST_CONFIG.testParams.length}`,
    `🎯 URL alvo: ${TEST_CONFIG.baseUrl}`,
    `🌐 Destinos: ${TEST_CONFIG.targetUrls.join(', ')}`,
    '-----------------------------------------------\n',
  ];

  // Adiciona as vulnerabilidades detectadas
  if (TEST_RESULTS.reportContent.length > 0) {
    report.push(...TEST_RESULTS.reportContent);
  } else {
    report.push('🔴 Nenhuma vulnerabilidade de open redirect encontrada!\n');
  }

  // Adiciona as estatísticas finais
  report.push(
    '\n📊 Estatísticas Finais:',
    `🔄 URLs testadas: ${TEST_RESULTS.testedUrls}`,
    `✅ Redirecionamentos detectados: ${TEST_RESULTS.totalDetected}`,
    `❌ Requisições falhas: ${TEST_RESULTS.failedRequests}\n`,
    TEST_RESULTS.totalDetected > 0
      ? '⚠️  Vulnerabilidades requerem atenção imediata!'
      : '✅ Nenhuma vulnerabilidade encontrada!'
  );

  return report.join('\n');
}

async function runSecurityTests() {
  const wordlistPath = path.join(__dirname, 'params.txt');
  TEST_CONFIG.testParams = await loadWordlist(wordlistPath);

  const totalRequests = TEST_CONFIG.testParams.length * TEST_CONFIG.targetUrls.length * 2;
  const estimatedTime = calculateEstimatedTime(totalRequests, TEST_CONFIG.delayBetweenRequests);

  // Cabeçalho inicial
  console.log(`${textColors.cyan}
🔎 Iniciando teste de Open Redirect
🛡️  Parâmetros: ${TEST_CONFIG.testParams.length}
🎯 URL alvo: ${TEST_CONFIG.baseUrl}
🌐 Destinos: ${TEST_CONFIG.targetUrls.join(', ')}
⏳ Aguarde (tempo estimado: ${estimatedTime})...${textColors.reset}\n`);

  // Execução dos testes
  for (const param of TEST_CONFIG.testParams) {
    await Promise.all(TEST_CONFIG.targetUrls.map(async (targetUrl) => {
      await testRedirectParameter(param, targetUrl, false);
      await sleep(TEST_CONFIG.delayBetweenRequests);
      await testRedirectParameter(param, targetUrl, true);
      await sleep(TEST_CONFIG.delayBetweenRequests);
    }));
  }

  // Resultado final no terminal
  console.log(`${textColors.green}
📊 Relatório Final:
🔄 URLs testadas: ${TEST_RESULTS.testedUrls}
✅ Redirecionamentos detectados: ${TEST_RESULTS.totalDetected}
❌ Requisições falhas: ${TEST_RESULTS.failedRequests}${textColors.reset}`);

  if (TEST_RESULTS.totalDetected === 0) {
    console.log(`\n${textColors.red}🔴 Nenhuma vulnerabilidade de open redirect encontrada!${textColors.reset}`);
  }

  // Gera arquivo de relatório
  fs.writeFileSync(
    path.join(__dirname, 'report.txt'),
    await generateReport(),
    'utf-8'
  );
  console.log(`\n${textColors.cyan}📄 Relatório salvo em: ${path.resolve(__dirname, 'report.txt')}${textColors.reset}`);
}

runSecurityTests();