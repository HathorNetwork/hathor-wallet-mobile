// Example webpack bundle entry point
// This demonstrates how to create a bundle that can be consumed by Metro

// Example utility functions
function formatCurrency(amount, currency = 'HTR') {
  return `${amount.toFixed(2)} ${currency}`;
}

function validateAddress(address) {
  // Simple validation - in real use case you'd have proper validation
  return typeof address === 'string' && address.length > 10;
}

// Example class
class WalletUtils {
  static generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
  }
}

// Factory function to create the React Native screen (inline to avoid import issues)
function createWebpackTestScreen(React, ReactNative) {
  const { useState } = React;
  const { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } = ReactNative;

  const WebpackTestScreen = () => {
    const [counter, setCounter] = useState(0);
    const [testResults, setTestResults] = useState(null);

    const runTests = () => {
      try {
        const results = {
          version: '1.0.0',
          formatCurrency: formatCurrency(123.45, 'HTR'),
          validateAddress: validateAddress('H123456789test'),
          generateId: WalletUtils.generateId(),
          sanitizeInput: WalletUtils.sanitizeInput('<script>alert("test")</script>'),
          timestamp: new Date().toLocaleTimeString()
        };
        setTestResults(results);
        Alert.alert('Tests Complete', 'Webpack bundle functions executed successfully!');
      } catch (error) {
        Alert.alert('Test Failed', error.message);
        console.error('Webpack bundle test failed:', error);
      }
    };

    return React.createElement(View, { style: styles.container },
      React.createElement(ScrollView, { style: styles.scrollView },
        React.createElement(Text, { style: styles.title }, 'Webpack Bundle Test Screen'),
        React.createElement(Text, { style: styles.subtitle }, 'This screen is bundled by webpack!'),
        
        React.createElement(View, { style: styles.section },
          React.createElement(Text, { style: styles.sectionTitle }, 'Counter Test'),
          React.createElement(Text, { style: styles.counterText }, `Count: ${counter}`),
          React.createElement(TouchableOpacity, {
            style: styles.button,
            onPress: () => setCounter(counter + 1)
          },
            React.createElement(Text, { style: styles.buttonText }, 'Increment')
          )
        ),

        React.createElement(View, { style: styles.section },
          React.createElement(Text, { style: styles.sectionTitle }, 'Webpack Bundle Functions'),
          React.createElement(TouchableOpacity, {
            style: styles.button,
            onPress: runTests
          },
            React.createElement(Text, { style: styles.buttonText }, 'Run Bundle Tests')
          )
        ),

        testResults && React.createElement(View, { style: styles.section },
          React.createElement(Text, { style: styles.sectionTitle }, `Test Results (${testResults.timestamp})`),
          React.createElement(Text, { style: styles.resultText }, `Version: ${testResults.version}`),
          React.createElement(Text, { style: styles.resultText }, `Format Currency: ${testResults.formatCurrency}`),
          React.createElement(Text, { style: styles.resultText }, `Validate Address: ${testResults.validateAddress.toString()}`),
          React.createElement(Text, { style: styles.resultText }, `Generated ID: ${testResults.generateId}`),
          React.createElement(Text, { style: styles.resultText }, `Sanitized Input: ${testResults.sanitizeInput}`)
        ),

        React.createElement(View, { style: styles.section },
          React.createElement(Text, { style: styles.infoText }, 
            '✅ This screen proves webpack can bundle React Native components\n' +
            '✅ Webpack bundle can import its own utilities\n' +
            '✅ State management works correctly\n' +
            '✅ React Native APIs (Alert, TouchableOpacity) work\n'
          )
        )
      )
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    scrollView: {
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 10,
      color: '#333',
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 30,
      color: '#666',
      fontStyle: 'italic',
    },
    section: {
      backgroundColor: 'white',
      borderRadius: 8,
      padding: 15,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#333',
    },
    counterText: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 10,
      color: '#333',
    },
    button: {
      backgroundColor: '#007AFF',
      borderRadius: 6,
      padding: 12,
      alignItems: 'center',
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    resultText: {
      fontSize: 14,
      marginBottom: 5,
      color: '#333',
      fontFamily: 'monospace',
    },
    infoText: {
      fontSize: 14,
      color: '#666',
      lineHeight: 20,
    },
  });

  return WebpackTestScreen;
}

// Create the main export object
const webpackBundle = {
  formatCurrency,
  validateAddress,
  WalletUtils,
  createWebpackTestScreen,
  version: '1.0.0'
};

// CommonJS export (React Native compatible)
module.exports = webpackBundle;