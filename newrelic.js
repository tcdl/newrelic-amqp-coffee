exports.config = {
  app_name: ['My Application'],
  license_key: 'license key here',
  encoding_key: 'xxx',
  obfuscatedId: 'xxx',
  utilization: {
    detect_aws: false,
    detect_pcf: false,
    detect_azure: false,
    detect_gcp: false,
    detect_docker: false
  },
  transaction_tracer: {
    enabled: true
  }
};
