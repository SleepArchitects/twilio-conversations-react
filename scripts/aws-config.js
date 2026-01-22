const ENV_CODES = {
  develop: 'd',
  staging: 's',
  production: 'p'
};

const DOMAINS = {
  develop: 'outreach-dev.mydreamconnect.com',
  staging: 'outreach-stage.mydreamconnect.com',
  production: 'outreach.mydreamconnect.com'
};

const HOSTED_ZONE_ID = 'Z08906651MH5LAQCJWIT3'; // mydreamconnect.com

const TAGS = {
  Project: 'outreach',
  ManagedBy: 'scripts'
};

function getResourceNames(env) {
  if (!ENV_CODES[env]) {
    throw new Error(`Invalid environment: ${env}. Must be one of: ${Object.keys(ENV_CODES).join(', ')}`);
  }

  const code = ENV_CODES[env];
  const suffix = 'outreach';
  
  // Enforced override per user instruction
  const roleName = 'lambda-dynamodb-execution-role';

  // Legacy overrides for 'develop' environment to match existing resources
  if (env === 'develop') {
    return {
      lambdaName: 'sax-lambda-us-east-1-0x-d-outreach-server_develop',
      bucketName: 'sax-nextjs-us-east-1-develop-outreach-assets',
      roleName: roleName, 
      domainName: DOMAINS[env],
      stackName: `sax-outreach-${env}`,
      tags: { ...TAGS, Environment: env }
    };
  }
  
  // Strict convention for new environments (staging/production)
  return {
    lambdaName: `sax-lam-us-east-1-0x-${code}-${suffix}`,
    bucketName: `sax-s3-us-east-1-0x-${code}-${suffix}-assets`,
    roleName: roleName,
    domainName: DOMAINS[env],
    stackName: `sax-outreach-${env}`,
    tags: {
      ...TAGS,
      Environment: env
    }
  };
}

module.exports = {
  ENV_CODES,
  DOMAINS,
  HOSTED_ZONE_ID,
  getResourceNames
};
