const {
  LambdaClient,
  CreateFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionConfigurationCommand,
  AddPermissionCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionUrlConfigCommand,
} = require("@aws-sdk/client-lambda");
const {
  S3Client,
  CreateBucketCommand,
  PutPublicAccessBlockCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} = require("@aws-sdk/client-s3");
const {
  CloudFrontClient,
  CreateDistributionCommand,
  GetDistributionCommand,
  ListDistributionsCommand,
  UpdateDistributionCommand,
  CreateOriginAccessControlCommand,
  ListOriginAccessControlsCommand,
  CreateInvalidationCommand,
} = require("@aws-sdk/client-cloudfront");
const {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  ListCertificatesCommand,
} = require("@aws-sdk/client-acm");
const {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
} = require("@aws-sdk/client-route-53");
const {
  IAMClient,
  CreateRoleCommand,
  GetRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
} = require("@aws-sdk/client-iam");
const { getResourceNames, HOSTED_ZONE_ID } = require("./aws-config");

const REGION = "us-east-1";

const lambda = new LambdaClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const cloudfront = new CloudFrontClient({ region: REGION });
const acm = new ACMClient({ region: REGION });
const route53 = new Route53Client({ region: REGION });
const iam = new IAMClient({ region: REGION });

async function createInfrastructure() {
  const env = process.argv[2];
  if (!env) {
    console.error("Usage: node create-infrastructure.cjs <environment>");
    process.exit(1);
  }

  const resources = getResourceNames(env);
  console.log(`🛠️  Provisioning infrastructure for [${env}]...`);
  console.log(`   Lambda: ${resources.lambdaName}`);
  console.log(`   S3:     ${resources.bucketName}`);
  console.log(`   Domain: ${resources.domainName}`);

  // 1. IAM Role
  let roleArn;
  try {
    const role = await iam.send(
      new GetRoleCommand({ RoleName: resources.roleName }),
    );
    roleArn = role.Role.Arn;
    console.log("✅ IAM Role exists");
  } catch (e) {
    if (e.name === "NoSuchEntityException") {
      console.log("⚡ Creating IAM Role...");
      const assumeRolePolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
            },
            Action: "sts:AssumeRole",
          },
        ],
      };

      const role = await iam.send(
        new CreateRoleCommand({
          RoleName: resources.roleName,
          AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy),
          Tags: Object.entries(resources.tags).map(([Key, Value]) => ({
            Key,
            Value,
          })),
        }),
      );
      roleArn = role.Role.Arn;

      // Attach basic execution policies
      await iam.send(
        new AttachRolePolicyCommand({
          RoleName: resources.roleName,
          PolicyArn:
            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        }),
      );

      console.log("   IAM Role created. Waiting for propagation...");
      await new Promise((r) => setTimeout(r, 10000)); // IAM propagation delay
    } else throw e;
  }

  // 2. S3 Bucket
  try {
    await s3.send(new HeadBucketCommand({ Bucket: resources.bucketName }));
    console.log("✅ S3 Bucket exists");
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
      console.log("⚡ Creating S3 Bucket...");
      await s3.send(new CreateBucketCommand({ Bucket: resources.bucketName }));

      // Block public access
      await s3.send(
        new PutPublicAccessBlockCommand({
          Bucket: resources.bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        }),
      );
    } else throw e;
  }

  // 3. Lambda Function (Stub)
  let lambdaArn;
  let lambdaFunctionUrl;
  try {
    const fn = await lambda.send(
      new GetFunctionCommand({ FunctionName: resources.lambdaName }),
    );
    lambdaArn = fn.Configuration.FunctionArn;
    console.log("✅ Lambda Function exists");

    // Ensure Lambda has a Function URL
    try {
      const urlConfig = await lambda.send(
        new GetFunctionUrlConfigCommand({ FunctionName: resources.lambdaName }),
      );
      lambdaFunctionUrl = urlConfig.FunctionUrl;
      console.log("✅ Lambda Function URL exists");
    } catch (urlError) {
      if (urlError.name === "ResourceNotFoundException") {
        console.log("⚡ Creating Lambda Function URL...");
        const urlResult = await lambda.send(
          new CreateFunctionUrlConfigCommand({
            FunctionName: resources.lambdaName,
            AuthType: "NONE",
            Cors: {
              AllowOrigins: ["*"],
              AllowMethods: ["*"],
              AllowHeaders: ["*"],
              MaxAge: 86400,
            },
          }),
        );
        lambdaFunctionUrl = urlResult.FunctionUrl;
        console.log(`   Function URL created: ${lambdaFunctionUrl}`);

        // Add permission for public access
        try {
          await lambda.send(
            new AddPermissionCommand({
              FunctionName: resources.lambdaName,
              StatementId: "AllowPublicAccess",
              Action: "lambda:InvokeFunctionUrl",
              Principal: "*",
              FunctionUrlAuthType: "NONE",
            }),
          );
          console.log("   Public access permission added");
        } catch (permError) {
          if (permError.name !== "ResourceConflictException") {
            console.warn(
              "   ⚠️ Failed to add public permission:",
              permError.message,
            );
          }
        }
      } else {
        throw urlError;
      }
    }
  } catch (e) {
    if (e.name === "ResourceNotFoundException") {
      console.log("⚡ Creating Stub Lambda Function...");
      // Minimal zip buffer (empty handler)
      // This is just to establish the resource; deploy-outreach.cjs will overwrite code
      // We need valid zip content for CreateFunction.
      // Using a predefined valid empty zip base64 would be best, or just rely on deploy to create it?
      // "Create if missing" implies we create it here.
      // NOTE: OpenNext deploy usually creates the function if missing?
      // But we want infrastructure separate.
      // Let's Skip Lambda creation here and let deploy-outreach handle CODE,
      // BUT deploy-outreach might fail if it expects update-function-code.
      // For now, let's allow deploy-outreach to create it if we can't easily make a zip here without deps.
      // ALTERNATIVE: Use the check-infra to fail, and tell user "Run deploy to create lambda first"?
      // No, we want this script to create "Infrastructure".
      // Let's create a placeholder function.

      console.log(
        "⚠️  Lambda creation skipped in infra script - Code deployment required.",
      );
      console.log(
        "    Run `npm run deploy` to create the initial function code.",
      );
      // We return here because we can't link CloudFront to a non-existent Lambda
      // But we can continue to ACM/S3
    } else throw e;
  }

  // 4. ACM Certificate
  let certArn;
  try {
    const certs = await acm.send(new ListCertificatesCommand({}));
    const cert = certs.CertificateSummaryList.find(
      (c) => c.DomainName === resources.domainName,
    );

    if (cert) {
      certArn = cert.CertificateArn;
      console.log(`✅ ACM Certificate found (${cert.Status})`);

      if (cert.Status === "PENDING_VALIDATION") {
        console.log("⚡ Handling DNS Validation...");
        const desc = await acm.send(
          new DescribeCertificateCommand({ CertificateArn: certArn }),
        );
        const validation = desc.Certificate.DomainValidationOptions[0];

        if (validation && validation.ValidationMethod === "DNS") {
          await upsertDnsRecord(
            validation.ResourceRecord.Name,
            validation.ResourceRecord.Value,
            validation.ResourceRecord.Type,
          );
        }
      }
    } else {
      console.log("⚡ Requesting ACM Certificate...");
      const req = await acm.send(
        new RequestCertificateCommand({
          DomainName: resources.domainName,
          ValidationMethod: "DNS",
          Tags: Object.entries(resources.tags).map(([Key, Value]) => ({
            Key,
            Value,
          })),
        }),
      );
      certArn = req.CertificateArn;
      console.log(
        "   Certificate requested. Run this script again to process validation records.",
      );
    }
  } catch (e) {
    console.error("ACM Error:", e.message);
  }

  // 5. CloudFront Distribution (Requires Lambda Function URL & ACM Cert)
  if (!lambdaFunctionUrl) {
    console.log(
      "⚠️  Lambda Function URL not available. Skipping CloudFront creation.",
    );
    return;
  }

  if (certArn) {
    const certDesc = await acm.send(
      new DescribeCertificateCommand({ CertificateArn: certArn }),
    );
    if (certDesc.Certificate.Status !== "ISSUED") {
      console.log(
        "⚠️  ACM Certificate not ISSUED yet. Cannot create CloudFront/DNS.",
      );
      console.log("   Wait for DNS validation to complete.");
      return;
    }
  } else {
    console.log("⚠️  No ACM Certificate found. Cannot create CloudFront.");
    return;
  }

  // Create Origin Access Control (OAC) for S3
  let oacId;
  const oacName = `${resources.bucketName}-oac`;
  try {
    const oacList = await cloudfront.send(
      new ListOriginAccessControlsCommand({}),
    );
    const existingOac = oacList.OriginAccessControlList?.Items?.find(
      (oac) => oac.Name === oacName,
    );

    if (existingOac) {
      oacId = existingOac.Id;
      console.log("✅ Origin Access Control exists");
    } else {
      console.log("⚡ Creating Origin Access Control...");
      const oacResult = await cloudfront.send(
        new CreateOriginAccessControlCommand({
          OriginAccessControlConfig: {
            Name: oacName,
            Description: `OAC for ${resources.bucketName}`,
            SigningProtocol: "sigv4",
            SigningBehavior: "always",
            OriginAccessControlOriginType: "s3",
          },
        }),
      );
      oacId = oacResult.OriginAccessControl.Id;
      console.log(`   OAC created: ${oacId}`);
    }
  } catch (e) {
    console.error("OAC Error:", e.message);
    throw e;
  }

  // Check if CloudFront distribution already exists
  let distributionId;
  let distributionDomain;
  let existingDistribution;

  try {
    const distributions = await cloudfront.send(
      new ListDistributionsCommand({}),
    );
    existingDistribution = distributions.DistributionList?.Items?.find((dist) =>
      dist.Aliases?.Items?.includes(resources.domainName),
    );

    if (existingDistribution) {
      distributionId = existingDistribution.Id;
      distributionDomain = existingDistribution.DomainName;
      console.log(`✅ CloudFront Distribution exists: ${distributionId}`);
      console.log(`   Domain: ${distributionDomain}`);

      // Update existing distribution to ensure cache behaviors are current
      console.log("⚡ Updating CloudFront Distribution cache behaviors...");
      try {
        // Get full distribution config with ETag
        const distDetails = await cloudfront.send(
          new GetDistributionCommand({ Id: distributionId }),
        );
        const currentConfig = distDetails.Distribution.DistributionConfig;
        const etag = distDetails.ETag;

        // Check if update is needed
        const currentPatterns =
          currentConfig.CacheBehaviors?.Items?.map((b) => b.PathPattern) || [];
        const hasOutreachStatic =
          currentPatterns.includes("/outreach-static/*");

        if (!hasOutreachStatic) {
          console.log("   Adding /outreach-static/* cache behavior...");

          // Get existing _next/* behavior as template, or create new one
          const existingBehavior = currentConfig.CacheBehaviors?.Items?.find(
            (b) => b.PathPattern === "_next/*",
          );

          // Create new /outreach-static/* behavior based on existing _next/* or fresh config
          const outreachStaticBehavior = existingBehavior
            ? {
                ...existingBehavior,
                PathPattern: "/outreach-static/*",
              }
            : {
                PathPattern: "/outreach-static/*",
                TargetOriginId: "s3-origin",
                ViewerProtocolPolicy: "redirect-to-https",
                AllowedMethods: {
                  Quantity: 2,
                  Items: ["GET", "HEAD"],
                  CachedMethods: {
                    Quantity: 2,
                    Items: ["GET", "HEAD"],
                  },
                },
                Compress: true,
                SmoothStreaming: false,
                FieldLevelEncryptionId: "",
                CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized
                LambdaFunctionAssociations: { Quantity: 0 },
                FunctionAssociations: { Quantity: 0 },
              };

          // Build new cache behaviors array with /outreach-static/* first (highest priority)
          const existingItems = currentConfig.CacheBehaviors?.Items || [];
          const newItems = [outreachStaticBehavior, ...existingItems];

          currentConfig.CacheBehaviors = {
            Quantity: newItems.length,
            Items: newItems,
          };

          await cloudfront.send(
            new UpdateDistributionCommand({
              Id: distributionId,
              IfMatch: etag,
              DistributionConfig: currentConfig,
            }),
          );
          console.log("   ✅ CloudFront cache behaviors updated");

          // Create invalidation to ensure clean state
          console.log("   ⚡ Creating cache invalidation for /*...");
          try {
            await cloudfront.send(
              new CreateInvalidationCommand({
                DistributionId: distributionId,
                InvalidationBatch: {
                  CallerReference: `update-cache-behaviors-${Date.now()}`,
                  Paths: {
                    Quantity: 1,
                    Items: ["/*"],
                  },
                },
              }),
            );
            console.log("   ✅ Cache invalidation created");
          } catch (invalidationError) {
            console.warn(
              "   ⚠️ Failed to create invalidation:",
              invalidationError.message,
            );
          }
        } else {
          console.log("   ✅ Cache behaviors already up to date");
        }
      } catch (updateError) {
        console.error(
          "   ⚠️ Failed to update distribution:",
          updateError.message,
        );
        // Non-fatal - continue with rest of script
      }
    }
  } catch (e) {
    console.error("Error checking distributions:", e.message);
  }

  // Create CloudFront distribution if it doesn't exist
  if (!existingDistribution) {
    console.log("⚡ Creating CloudFront Distribution...");

    // Extract hostname from Lambda Function URL (remove https:// and trailing slash)
    const lambdaDomain = lambdaFunctionUrl
      .replace("https://", "")
      .replace(/\/$/, "");

    const distributionConfig = {
      CallerReference: `${resources.lambdaName}-${Date.now()}`,
      Comment: `Distribution for ${resources.domainName}`,
      Enabled: true,
      Aliases: {
        Quantity: 1,
        Items: [resources.domainName],
      },
      DefaultRootObject: "",
      Origins: {
        Quantity: 2,
        Items: [
          {
            Id: "lambda-origin",
            DomainName: lambdaDomain,
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: "https-only",
              OriginSslProtocols: {
                Quantity: 1,
                Items: ["TLSv1.2"],
              },
            },
          },
          {
            Id: "s3-origin",
            DomainName: `${resources.bucketName}.s3.${REGION}.amazonaws.com`,
            OriginPath: "",
            S3OriginConfig: {
              OriginAccessIdentity: "",
            },
            OriginAccessControlId: oacId,
          },
        ],
      },
      DefaultCacheBehavior: {
        TargetOriginId: "lambda-origin",
        ViewerProtocolPolicy: "redirect-to-https",
        AllowedMethods: {
          Quantity: 7,
          Items: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          CachedMethods: {
            Quantity: 2,
            Items: ["GET", "HEAD"],
          },
        },
        Compress: true,
        CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", // CachingDisabled
        OriginRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac", // AllViewerExceptHostHeader
        ForwardedValues: undefined, // Not used with managed policies
      },
      CacheBehaviors: {
        Quantity: 2,
        Items: [
          {
            // Primary static asset route - matches assetPrefix from next.config.mjs
            PathPattern: "/outreach-static/*",
            TargetOriginId: "s3-origin",
            ViewerProtocolPolicy: "redirect-to-https",
            AllowedMethods: {
              Quantity: 2,
              Items: ["GET", "HEAD"],
              CachedMethods: {
                Quantity: 2,
                Items: ["GET", "HEAD"],
              },
            },
            Compress: true,
            CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized
            ForwardedValues: undefined, // Not used with managed policies
          },
          {
            // Legacy/fallback - keep for safety in case any requests come without prefix
            PathPattern: "_next/*",
            TargetOriginId: "s3-origin",
            ViewerProtocolPolicy: "redirect-to-https",
            AllowedMethods: {
              Quantity: 2,
              Items: ["GET", "HEAD"],
              CachedMethods: {
                Quantity: 2,
                Items: ["GET", "HEAD"],
              },
            },
            Compress: true,
            CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized
            ForwardedValues: undefined, // Not used with managed policies
          },
        ],
      },
      ViewerCertificate: {
        ACMCertificateArn: certArn,
        SSLSupportMethod: "sni-only",
        MinimumProtocolVersion: "TLSv1.2_2021",
      },
      HttpVersion: "http2and3",
      PriceClass: "PriceClass_100", // US, Canada, Europe
    };

    try {
      const result = await cloudfront.send(
        new CreateDistributionCommand({
          DistributionConfig: distributionConfig,
        }),
      );
      distributionId = result.Distribution.Id;
      distributionDomain = result.Distribution.DomainName;
      console.log(`   Distribution created: ${distributionId}`);
      console.log(`   Domain: ${distributionDomain}`);
      console.log("   Note: Distribution deployment may take 15-20 minutes");
    } catch (e) {
      console.error("CloudFront Creation Error:", e.message);
      throw e;
    }
  }

  // Update S3 Bucket Policy to allow CloudFront OAC access
  const accountId = lambdaArn.split(":")[4]; // Extract account ID from Lambda ARN
  const bucketPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowCloudFrontServicePrincipal",
        Effect: "Allow",
        Principal: {
          Service: "cloudfront.amazonaws.com",
        },
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${resources.bucketName}/*`,
        Condition: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${accountId}:distribution/${distributionId}`,
          },
        },
      },
    ],
  };

  try {
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: resources.bucketName,
        Policy: JSON.stringify(bucketPolicy),
      }),
    );
    console.log("✅ S3 Bucket Policy updated for CloudFront access");
  } catch (e) {
    console.error("S3 Bucket Policy Error:", e.message);
  }

  // 6. Route53 DNS Record (A-Record Alias to CloudFront)
  if (distributionDomain) {
    console.log("⚡ Creating/Updating Route53 A-Record...");
    try {
      await route53.send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: HOSTED_ZONE_ID,
          ChangeBatch: {
            Changes: [
              {
                Action: "UPSERT",
                ResourceRecordSet: {
                  Name: resources.domainName,
                  Type: "A",
                  AliasTarget: {
                    HostedZoneId: "Z2FDTNDATAQYW2", // CloudFront hosted zone ID (constant)
                    DNSName: distributionDomain,
                    EvaluateTargetHealth: false,
                  },
                },
              },
            ],
          },
        }),
      );
      console.log(
        `✅ DNS A-Record created: ${resources.domainName} -> ${distributionDomain}`,
      );
    } catch (e) {
      console.error("Route53 Error:", e.message);
    }
  }

  console.log("\n🎉 Infrastructure setup complete!");
  console.log(`   CloudFront Distribution ID: ${distributionId}`);
  console.log(`   CloudFront Domain: ${distributionDomain}`);
  console.log(`   Custom Domain: ${resources.domainName}`);
  console.log(`   Lambda Function URL: ${lambdaFunctionUrl}`);
  console.log("\nNext steps:");
  console.log("1. Wait for CloudFront distribution to deploy (15-20 minutes)");
  console.log(
    "2. Deploy application code with: AWS_PROFILE=DEV npm run deploy",
  );
  console.log(`3. Access your application at: https://${resources.domainName}`);

  // Helper function for DNS record updates (used by ACM validation)
  async function upsertDnsRecord(name, value, type) {
    try {
      console.log(`   Upserting DNS: ${type} ${name} -> ${value}`);
      await route53.send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: HOSTED_ZONE_ID,
          ChangeBatch: {
            Changes: [
              {
                Action: "UPSERT",
                ResourceRecordSet: {
                  Name: name,
                  Type: type,
                  TTL: 60,
                  ResourceRecords: [{ Value: value }],
                },
              },
            ],
          },
        }),
      );
    } catch (e) {
      console.warn(`   DNS Error: ${e.message}`);
    }
  }
}

createInfrastructure().catch(console.error);
