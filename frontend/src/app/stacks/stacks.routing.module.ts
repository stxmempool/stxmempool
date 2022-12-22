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



const routes: Routes = [
  // {
  //   path: '',
  //   pathMatch: 'full',
  //   loadChildren: () => import('../graphs/graphs.module').then(m => m.GraphsModule)
  // },
  {
    path: '',
    component: StacksStartComponent,
    // component: StacksMasterPageComponent,
    children: [
      {
        path: '',
        component: StacksDashboardComponent,
      }
      // {
      //   path: 'tx/push',
      //   component: PushTransactionComponent,
      // },
      // {
      //   path: 'about',
      //   component: AboutComponent,
      // },
      // {
      //   path: 'blocks',
      //   component: BlocksList,
      // },
      // {
      //   path: 'terms-of-service',
      //   component: TermsOfServiceComponent
      // },
      // {
      //   path: 'privacy-policy',
      //   component: PrivacyPolicyComponent
      // },
      // {
      //   path: 'trademark-policy',
      //   component: TrademarkPolicyComponent
      // },
      // {
      //   path: 'address/:id',
      //   children: [],
      //   component: AddressComponent,
      //   data: {
      //     ogImage: true,
      //     networkSpecific: true,
      //   }
      // },
      // {
      //   path: 'tx',
      //   data: { networkSpecific: true },
      //   component: StartComponent,
      //   children: [
      //     {
      //       path: ':id',
      //       component: TransactionComponent
      //     },
      //   ],
      // },
      // {
      //   path: 'block',
      //   data: { networkSpecific: true },
      //   component: StartComponent,
      //   children: [
      //     {
      //       path: ':id',
      //       component: BlockComponent,
      //       data: {
      //         ogImage: true
      //       }
      //     },
      //   ],
      // },
      // {
      //   path: 'assets',
      //   data: { networks: ['liquid'] },
      //   component: AssetsNavComponent,
      //   children: [
      //     {
      //       path: 'featured',
      //       data: { networkSpecific: true },
      //       component: AssetsFeaturedComponent,
      //     },
      //     {
      //       path: 'all',
      //       data: { networks: ['liquid'] },
      //       component: AssetsComponent,
      //     },
      //     {
      //       path: 'asset/:id',
      //       data: { networkSpecific: true },
      //       component: AssetComponent
      //     },
      //     {
      //       path: 'group/:id',
      //       data: { networkSpecific: true },
      //       component: AssetGroupComponent
      //     },
      //     {
      //       path: '**',
      //       redirectTo: 'featured'
      //     }
      //   ]
      // },
    ]
  },
  // {
  //   path: 'about',
  //   component: AboutComponent
  // }
  
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})

export class StacksRoutingModule{ }