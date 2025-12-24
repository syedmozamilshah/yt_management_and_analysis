# Remotion Lambda AWS IAM Policies

This document contains the AWS IAM policies required for Remotion Lambda video rendering setup.

---

## 🔐 1. ROLE POLICY (remotion-lambda-policy)

**Purpose:** This policy should be attached to an IAM Role named `remotion-lambda-role`.

**Instructions for Boss:**
1. Go to AWS Console → IAM → Policies → Create Policy
2. Click "JSON" tab
3. Paste the JSON below
4. Name the policy: `remotion-lambda-policy`
5. Create a Role named `remotion-lambda-role` and attach this policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "0",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Sid": "1",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:PutBucketAcl",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl",
        "s3:PutObject",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::remotionlambda-*"
      ]
    },
    {
      "Sid": "2",
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:remotion-render-*"
      ]
    },
    {
      "Sid": "3",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda-insights"
      ]
    },
    {
      "Sid": "4",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*",
        "arn:aws:logs:*:*:log-group:/aws/lambda-insights:*"
      ]
    }
  ]
}
```

---

## 👤 2. USER POLICY (remotion-user-policy)

**Purpose:** This policy should be attached to an IAM User that will be used to deploy and invoke Remotion Lambda functions.

**Instructions for Boss:**
1. Go to AWS Console → IAM → Policies → Create Policy
2. Click "JSON" tab
3. Paste the JSON below
4. Name the policy: `remotion-user-policy`
5. Attach this policy to the IAM user that will run Remotion commands

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "HandleQuotas",
      "Effect": "Allow",
      "Action": [
        "servicequotas:GetServiceQuota",
        "servicequotas:GetAWSDefaultServiceQuota",
        "servicequotas:RequestServiceQuotaIncrease",
        "servicequotas:ListRequestedServiceQuotaChangeHistoryByQuota"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Sid": "PermissionValidation",
      "Effect": "Allow",
      "Action": [
        "iam:SimulatePrincipalPolicy"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Sid": "LambdaInvokation",
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/remotion-lambda-role"
      ]
    },
    {
      "Sid": "Storage",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl",
        "s3:PutObject",
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:PutBucketAcl",
        "s3:DeleteBucket",
        "s3:PutBucketOwnershipControls",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutLifecycleConfiguration"
      ],
      "Resource": [
        "arn:aws:s3:::remotionlambda-*"
      ]
    },
    {
      "Sid": "BucketListing",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Sid": "FunctionListing",
      "Effect": "Allow",
      "Action": [
        "lambda:ListFunctions",
        "lambda:GetFunction"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Sid": "FunctionManagement",
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeAsync",
        "lambda:InvokeFunction",
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:PutFunctionEventInvokeConfig",
        "lambda:PutRuntimeManagementConfig",
        "lambda:TagResource"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:remotion-render-*"
      ]
    },
    {
      "Sid": "LogsRetention",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:PutRetentionPolicy"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*"
      ]
    },
    {
      "Sid": "FetchBinaries",
      "Effect": "Allow",
      "Action": [
        "lambda:GetLayerVersion"
      ],
      "Resource": [
        "arn:aws:lambda:*:678892195805:layer:remotion-binaries-*",
        "arn:aws:lambda:*:580247275435:layer:LambdaInsightsExtension*"
      ]
    }
  ]
}
```

---

## 📋 Summary of Required AWS Setup

| Item | Name | Type |
|------|------|------|
| Policy 1 | `remotion-lambda-policy` | IAM Policy (for Role) |
| Policy 2 | `remotion-user-policy` | IAM Policy (for User) |
| Role | `remotion-lambda-role` | IAM Role |
| User | (your choice) | IAM User with `remotion-user-policy` |

---

## 🔧 Remotion Version

All Remotion packages are locked to version **4.0.391** (no ^ prefix).

Installed packages:
- `remotion@4.0.391`
- `@remotion/cli@4.0.391`
- `@remotion/bundler@4.0.391`
- `@remotion/renderer@4.0.391`
- `@remotion/lambda@4.0.391`

---

## 📁 Project Structure Created

```
src/
 └─ remotion/
     ├─ index.ts            // Remotion entry file
     ├─ Root.tsx            // Registers compositions
     └─ compositions/
         └─ MainVideo.tsx   // Main video logic
```

---

**Generated on:** December 16, 2025
