import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from '../components/about/about.component';
import { AddressComponent } from '../components/address/address.component';
import { AssetComponent } from '../components/asset/asset.component';
import { AssetGroupComponent } from '../components/assets/asset-group/asset-group.component';
import { AssetsFeaturedComponent } from '../components/assets/assets-featured/assets-featured.component';
import { AssetsNavComponent } from '../components/assets/assets-nav/assets-nav.component';
import { AssetsComponent } from '../components/assets/assets.component';
import { BlockComponent } from '../components/block/block.component';
import { BlockchainComponent } from '../components/blockchain/blockchain.component';
import { BlocksList } from '../components/blocks-list/blocks-list.component';
import { MempoolBlocksComponent } from '../components/mempool-blocks/mempool-blocks.component';
import { MempoolBlockComponent } from '../components/mempool-block/mempool-block.component';
import { PrivacyPolicyComponent } from '../components/privacy-policy/privacy-policy.component';
import { PushTransactionComponent } from '../components/push-transaction/push-transaction.component';
import { StacksMasterPageComponent } from '../components/stacks-master-page/stacks-master-page.component';
import { StartComponent } from '../components/start/start.component';
import { StacksStartComponent } from './stacks-start/stacks-start.component';
import { TermsOfServiceComponent } from '../components/terms-of-service/terms-of-service.component';
import { TrademarkPolicyComponent } from '../components/trademark-policy/trademark-policy.component';
import { TransactionComponent } from '../components/transaction/transaction.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { StacksDashboardComponent } from './stacks-dashboard/stacks-dashboard.component';
import { StacksBlockchainComponent } from '../stacks/stacks-blockchain/stacks-blockchain.component';
import { StacksBlockComponent } from '../stacks/stacks-block/stacks-block.component';
import { StacksMempoolBlocksComponent } from '../stacks/stacks-mempool-blocks/stacks-mempool-blocks.component';
import { StacksMempoolBlockComponent } from './stacks-mempool-block/stacks-mempool-block.component';
import { StacksTransactionComponent } from './stacks-transaction/stacks-transaction.component';






const routes: Routes = [
  {
    path: '',
    component: StacksStartComponent,
    children: [
      {
        path: '',
        component: StacksDashboardComponent,
      }
    ],
  },
  {
    path: 'block',
    data: { networkSpecific: true },
    component: StacksStartComponent,
    children: [
      {
        path: ':id',
        component: StacksBlockComponent,
        data: {
          ogImage: true
        }
      },
    ],
  },
  {
    path: 'mempool-block/:id',
    data: { networks: ['bitcoin', 'liquid'] },
    component: StacksStartComponent,
    children: [
      {
        path: '',
        component: StacksMempoolBlockComponent,
        data: {
          ogImage: true
        }
      },
    ],
  },
  {
    path: 'tx',
    data: { networkSpecific: true },
    component: StacksStartComponent,
    children: [
      {
        path: ':id',
        component: StacksTransactionComponent
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})

export class StacksRoutingModule{ }