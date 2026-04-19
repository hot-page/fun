import { bold, green, yellow, red, gray, cyan } from 'nanocolors'
import { relative } from 'path'

function printSuite(logger, suite, indent = '') {
  if (suite.name) {
    logger.log(`${indent}${bold(suite.name)}`)
  }
  const suiteIndent = suite.name ? indent + '  ' : indent
  for (const test of suite.tests) {
    if (test.skipped) {
      logger.log(`${suiteIndent}${yellow('-')} ${yellow(test.name)}`)
    } else if (test.passed) {
      logger.log(`${suiteIndent}${green('✓')} ${test.name}`)
    } else {
      logger.log(`${suiteIndent}${red('✗')} ${bold(red(test.name))}`)
    }
  }
  for (const child of suite.suites) {
    printSuite(logger, child, suiteIndent)
  }
}

export function specReporter() {
  return {
    reportTestFileResults({ logger, sessionsForTestFile, testFile }) {
      logger.log(`\n${bold(cyan(relative(process.cwd(), testFile)))}`)
      for (const session of sessionsForTestFile) {
        if (session.testResults) {
          printSuite(logger, session.testResults)
        }
      }
    },
  }
}
